// ============================================================
// Default roster for the conference (loaded into Firestore once by an admin
// using "Load Conference Roster" on the Duty Roster page; fully editable afterwards).
// ============================================================
(function () {
  const D = {
    vidIn: [
      "Operate your assigned camera inside the hall and capture full sessions, ministrations and congregation moments.",
      "Keep framing steady and consistent; coordinate camera angles with the other videographers.",
      "Check batteries, memory cards and storage before and after each session.",
      "Back up footage and hand it over to the media lead at the end of the day."
    ],
    vidOut: [
      "Cover arrivals, registration, venue ambience and B-roll outside the hall.",
      "Capture the arrival of the ministers on video.",
      "When there is little to shoot outside, come in and assist the team working inside."
    ],
    vidSession: [
      "Cover your session fully – ministrations, worship, altar moments and audience reactions.",
      "Rotate camera positions with your teammates so no important moment is missed.",
      "Check batteries, cards and storage before and after the session; back up footage afterwards."
    ],
    vidFull: [
      "Cover the full programme for the day – worship, ministrations, announcements and audience moments.",
      "Share camera positions fairly and keep shots consistent in colour and framing.",
      "Check batteries, cards and storage before and after; back up footage at the end of the day."
    ],
    photoIn: [
      "Capture ministers on stage, ministrations, worship and congregation moments from inside the hall.",
      "Use the prime lens for stage portraits and key moments.",
      "Shortlist your best shots and upload them to the Gallery (Photography album) after the day."
    ],
    photoOut: [
      "Stay outside to take good shots of the ministers' arrival – this post must not be left unattended.",
      "Use the prime lens for sharp, high-quality portraits.",
      "When arrivals are done and there is little to shoot outside, come in and assist the photographers inside."
    ],
    photoSession: [
      "Cover your session – ministers, ministrations, worship and congregation.",
      "Use the prime lens for key shots.",
      "Upload your best shots to the Gallery (Photography album) after the session."
    ],
    equipment: [
      "Set up, test and pack down all media equipment (cameras, tripods, lights, cables, batteries).",
      "Log equipment out and back in; report anything missing or damaged to the lead immediately.",
      "Make sure the prime lens and spare batteries/cards are available to the photographers."
    ],
    stream: [
      "Run the live stream and monitor stream health (audio, video, connection) throughout the programme.",
      "Operate projection: lyrics, slides, scriptures and announcements on time.",
      "Coordinate with Videography and Sound on camera feeds and switching."
    ],
    srt: [
      "Report to your post early and follow the instructions of the media lead.",
      "Support the Videography, Photography and Equipment teams wherever you are needed.",
      "Report any issues to the Help Desk straight away."
    ]
  };

  const S = (day, department, shift, order, people, duties) => ({ day, department, shift, order, people, duties });

  window.ROSTER_DATA = {
    team: [
      ["Sis Kalisha", "Videography"], ["Sis Fiyin", "Videography"], ["Bro Darasimi", "Videography"],
      ["Sis Tofunmi", "Videography"], ["Bro Ini", "Videography"], ["Sis Esther", "Videography"],
      ["Bro Idowu", "Videography"],
      ["Mr Idowu", "Photography"], ["Bro Ebenezer", "Photography"], ["Bro Fidelix", "Photography"],
      ["Mr Oyeneye", "Equipment"], ["Mr Talabi", "Equipment"],
      ["Bro Doyin", "Live Stream & Projection"], ["Mr Iruoje", "Live Stream & Projection"],
      ["Sis Tobi", "SRT"], ["Bro Great", "SRT"], ["Sis Hallelujah", "SRT"]
    ].map(([name, department]) => ({ name, department })),

    slots: [
      // THURSDAY
      S("Thursday", "Videography", "In", 1, ["Sis Kalisha"], D.vidIn),
      S("Thursday", "Videography", "Out", 2, ["Sis Fiyin", "Bro Darasimi"], D.vidOut),
      S("Thursday", "Photography", "In", 1, ["Mr Idowu"], D.photoIn),
      S("Thursday", "Photography", "Out", 2, ["Bro Ebenezer"], D.photoOut),
      // FRIDAY
      S("Friday", "Videography", "Full Day", 1, ["Sis Fiyin", "Bro Idowu", "Sis Tofunmi"], D.vidFull),
      S("Friday", "Photography", "In", 1, ["Mr Idowu", "Bro Fidelix"], D.photoIn),
      S("Friday", "Photography", "Out", 2, ["Bro Ebenezer"], D.photoOut),
      // SATURDAY
      S("Saturday", "Videography", "Morning", 1, ["Bro Darasimi", "Sis Kalisha", "Sis Tofunmi", "Bro Ini"], D.vidSession),
      S("Saturday", "Videography", "Evening", 2, ["Sis Fiyin", "Bro Idowu", "Sis Esther", "Bro Ini"], D.vidSession),
      S("Saturday", "Photography", "Morning", 1, ["Mr Idowu"], D.photoSession),
      S("Saturday", "Photography", "Out", 2, ["Bro Ebenezer"], D.photoOut),
      S("Saturday", "Photography", "Evening", 3, ["Bro Fidelix", "Bro Ebenezer"], D.photoSession),
      // SUNDAY
      S("Sunday", "Videography", "In & Out", 1, ["Sis Fiyin", "Sis Tofunmi", "Sis Kalisha", "Bro Ini"], D.vidFull),
      S("Sunday", "Photography", "In", 1, ["Mr Idowu", "Bro Ebenezer"], D.photoIn),
      S("Sunday", "Photography", "Out", 2, ["Sis Kalisha", "Bro Darasimi"], D.photoOut),
      // ALL DAYS
      S("ALL", "Equipment", "All Days", 1, ["Mr Oyeneye", "Mr Talabi"], D.equipment),
      S("ALL", "Live Stream & Projection", "All Days", 2, ["Bro Doyin", "Mr Iruoje"], D.stream),
      S("ALL", "SRT", "All Days", 3, ["Sis Tobi", "Bro Great", "Sis Hallelujah"], D.srt)
    ],

    directives: [
      "Bro Ebenezer needs to be outside so he is able to take good shots of the ministers' arrival.",
      "We need a prime lens for very good shots (mostly used for conferences like this) – Equipment team to confirm availability.",
      "On days when some people outside don't have much to do, they are to come inside and assist those working inside."
    ]
  };
})();
