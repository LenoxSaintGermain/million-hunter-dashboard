import { PDFParse, PasswordException, FormatError, InvalidPDFException } from "pdf-parse";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_FAST } from "../shared/models";

export type ParsedDocumentPage = {
  page: number;
  text: string;
};

export type ParseDocumentResult = {
  format: "text_pages";
  pages: ParsedDocumentPage[];
  pageCount: number;
  totalCharacters: number;
  ocrApplied?: boolean;
  ocrModel?: string;
};

export type ParseDealDocumentParams = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  allowOcr?: boolean;
  ocrModel?: string;
};

export async function parseDealDocument(params: ParseDealDocumentParams): Promise<ParseDocumentResult> {
  const { buffer, mimeType } = params;
  const allowOcr = params.allowOcr ?? true; // Default to true per operator authorization

  if (mimeType === "text/plain") {
    const text = buffer.toString("utf8");
    if (!text.trim()) {
      throw new Error("empty_document: Text document contains no extractable content");
    }
    if (text.length > 1_000_000) {
      throw new Error("text_budget_exceeded: Document text exceeds 1,000,000 character limit");
    }
    // Check if contains form-feed or explicit page breaks
    const rawPages = text.split(/\f|\n(?=--- PAGE \d+ ---)/);
    const pages = rawPages.map((p, idx) => ({
      page: idx + 1,
      text: p.replace(/^--- PAGE \d+ ---\n?/, "").trim(),
    })).filter(p => p.text.length > 0);

    const finalPages = pages.length ? pages : [{ page: 1, text: text.trim() }];
    if (finalPages.length > 100) {
      throw new Error("page_budget_exceeded: Document exceeds 100 page limit");
    }

    return {
      format: "text_pages",
      pages: finalPages,
      pageCount: finalPages.length,
      totalCharacters: finalPages.reduce((sum, p) => sum + p.text.length, 0),
    };
  }

  if (mimeType === "application/pdf" || mimeType === "application/octet-stream") {
    // Check magic bytes
    if (buffer.length < 5 || buffer.toString("utf8", 0, 5) !== "%PDF-") {
      throw new Error("malformed_pdf: File header is not a valid PDF (%PDF- header missing)");
    }

    let parser: any;
    try {
      parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      const pageCount = textResult.total ?? textResult.pages?.length ?? 0;

      if (pageCount === 0) {
        throw new Error("malformed_pdf: PDF contains zero pages");
      }
      if (pageCount > 100) {
        throw new Error(`page_budget_exceeded: PDF has ${pageCount} pages (limit is 100)`);
      }

      const pages: ParsedDocumentPage[] = [];
      let totalChars = 0;

      for (const item of textResult.pages) {
        const text = (item.text || "").trim();
        if (text.length > 100_000) {
          throw new Error(`text_budget_exceeded: Page ${item.num} exceeds 100,000 character limit`);
        }
        totalChars += text.length;
        pages.push({
          page: item.num,
          text,
        });
      }

      if (totalChars > 1_000_000) {
        throw new Error(`text_budget_exceeded: Total text ${totalChars} characters exceeds 1,000,000 limit`);
      }

      // Check for scanned / image-only PDFs:
      // If total extractable characters is 0 (or average < 10 characters per page on multi-page docs)
      const isScanned = totalChars === 0 || (pageCount > 1 && totalChars < pageCount * 10);
      if (isScanned) {
        if (!allowOcr || !process.env.GEMINI_API_KEY) {
          throw new Error("scanned_ocr_required: PDF contains scanned images or no extractable digital text; OCR required but not enabled without explicit operator permission");
        }

        // Approved Vision / Multimodal OCR route
        try {
          const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const modelId = params.ocrModel || GEMINI_FAST;
          const prompt = `You are a high-precision financial auditor transcribing a scanned SMB acquisition filing or CIM.
Extract all readable text verbatim. Transcribe financial tables, balance sheets, income statements, footnotes, and key metrics (Asking Price, Revenue, SDE, EBITDA, Inventory, FF&E, Real Estate, Debt/Financing terms) exactly as they appear.
Do not omit text, do not summarize, and do not invent numbers.
Format pages with header:
--- PAGE X ---
where X is the page number starting at 1.`;

          const ocrRes = await genai.models.generateContent({
            model: modelId,
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: "application/pdf",
                      data: buffer.toString("base64"),
                    },
                  },
                ],
              },
            ],
          });

          const ocrText = (ocrRes.text || "").trim();
          if (!ocrText) {
            throw new Error("scanned_ocr_failed: Vision model returned empty text from scanned document");
          }

          const rawOcrPages = ocrText.split(/\f|\n(?=--- PAGE \d+ ---)/);
          const ocrPages = rawOcrPages.map((p, idx) => ({
            page: idx + 1,
            text: p.replace(/^--- PAGE \d+ ---\n?/, "").trim(),
          })).filter(p => p.text.length > 0);

          const finalOcrPages = ocrPages.length ? ocrPages : [{ page: 1, text: ocrText }];
          if (finalOcrPages.length > 100) {
            throw new Error(`page_budget_exceeded: OCR output has ${finalOcrPages.length} pages (limit is 100)`);
          }

          const ocrTotalChars = finalOcrPages.reduce((sum, p) => sum + p.text.length, 0);
          if (ocrTotalChars > 1_000_000) {
            throw new Error(`text_budget_exceeded: OCR output ${ocrTotalChars} characters exceeds 1,000,000 limit`);
          }

          return {
            format: "text_pages",
            pages: finalOcrPages,
            pageCount: finalOcrPages.length,
            totalCharacters: ocrTotalChars,
            ocrApplied: true,
            ocrModel: modelId,
          };
        } catch (ocrErr: any) {
          if (ocrErr.message?.startsWith("page_budget_exceeded") || ocrErr.message?.startsWith("text_budget_exceeded")) {
            throw ocrErr;
          }
          throw new Error(`scanned_ocr_failed: ${ocrErr?.message || "OCR vision model failed to transcribe document"}`);
        }
      }

      return {
        format: "text_pages",
        pages,
        pageCount,
        totalCharacters: totalChars,
      };
    } catch (err: any) {
      if (err instanceof PasswordException || /password|encrypted/i.test(err?.message || "")) {
        throw new Error("encrypted_pdf: Document is encrypted or password-protected");
      }
      if (err instanceof FormatError || err instanceof InvalidPDFException) {
        throw new Error(`malformed_pdf: ${err.message}`);
      }
      if (
        err?.message?.startsWith("scanned_ocr_required") ||
        err?.message?.startsWith("scanned_ocr_failed") ||
        err?.message?.startsWith("page_budget_exceeded") ||
        err?.message?.startsWith("text_budget_exceeded") ||
        err?.message?.startsWith("malformed_pdf")
      ) {
        throw err;
      }
      throw new Error(`malformed_pdf: Failed to parse PDF: ${err?.message || "Unknown PDF parsing error"}`);
    } finally {
      if (parser && typeof parser.destroy === "function") {
        try {
          await parser.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  throw new Error(`unsupported_format: MIME type ${mimeType} is not supported`);
}
