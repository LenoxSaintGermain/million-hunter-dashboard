import React from "react";
import EditorialTopNav from "@/components/EditorialTopNav";
import { DealDocumentReviewDesk } from "@/components/DealDocumentReviewDesk";

export default function DealDocuments() {
  return (
    <EditorialTopNav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DealDocumentReviewDesk />
      </main>
    </EditorialTopNav>
  );
}
