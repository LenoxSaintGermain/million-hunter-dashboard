/* Authored fixture timeline. No captured session, voice or provider output. */
const advisorScript = {
  label: 'Scripted sample: authored, not a recorded session',
  events: [
    {t:0,type:'pose',pose:'reading'},
    {t:1800,type:'tool',name:'point_to_anchor',args:{anchorId:'margin'}},
    {t:1900,type:'pose',pose:'skeptical'},
    {t:2000,type:'transcript',role:'advisor',text:'The listing reports {compute:marginCents}¢ of cash flow per revenue dollar. Start with what is inside that number.'},
    {t:3400,type:'transcript',role:'advisor',text:'Rebuild the owner pay and add-backs before letting the multiple persuade you.'},
    {t:5200,type:'tool',name:'set_scenario',args:{shock:-40}},
    {t:5300,type:'transcript',role:'advisor',text:'At {compute:shock}, coverage is {compute:coverage}× in this model. That is arithmetic—not independent confirmation of the cash.'},
    {t:7600,type:'await_operator',choices:['dig','sponsor','read']}
  ],
  branches: {
    dig: [
      {t:0,type:'transcript',role:'operator',text:'Dig into the add-backs.'},
      {t:200,type:'transcript',role:'advisor',text:'Start with the tax returns, add-back schedule and replacement manager’s pay. Here is a scope to review; nothing will run.'},
      {t:700,type:'tool',name:'draft_dig',args:{noteId:'margin'}},
      {t:800,type:'end'}
    ],
    sponsor: [
      {t:0,type:'transcript',role:'operator',text:'Ask my sponsor.'},
      {t:200,type:'transcript',role:'advisor',text:'One sharp question, with the reported margin attached. Edit the draft before deciding what to do with it.'},
      {t:700,type:'tool',name:'draft_sponsor_note',args:{noteId:'margin'}},
      {t:800,type:'end'}
    ],
    read: [
      {t:0,type:'transcript',role:'operator',text:'Keep reading.'},
      {t:200,type:'transcript',role:'advisor',text:'Then return to the cash-flow challenge. Dig, ask your sponsor, or record your own judgment. That part stays with you.'},
      {t:700,type:'tool',name:'open_note',args:{noteId:'margin'}},
      {t:800,type:'end'}
    ]
  }
};
