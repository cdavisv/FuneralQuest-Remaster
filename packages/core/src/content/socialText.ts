// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "`${name}" is a colour code before a {name} placeholder, not a template.
/**
 * The multiplayer and social strings the original hard-coded in C++ (visits,
 * battle, the cafe, mail, the paper's crime section and announcements, and
 * the tournament lines of the log-on screen). Part of `ClassicText` as
 * `ClassicText.social`, so a content pack can replace any of them.
 * Placeholders are listed on each string; source lines cite legacy/source.
 */
export interface SocialText {
  visit: VisitText;
  battle: BattleText;
  cafe: CafeText;
  mail: MailText;
  news: NewsExtraText;
  lobby: LobbyText;
}

export interface VisitText {
  /** `init_location_info` name (commands_comp.cpp:185). */
  location: string;
  /** (:176-178) */
  note: string;
  /** (:112) */
  watchNone: string;
  /** (:117) */
  watchOne: string;
  /** (:120) {visits} */
  watchMany: string;
  buttons: {
    leave: string;
    look: string;
    visit: string;
    continue: string;
    tryDoor: string;
    pickLock: string;
    steal: string;
    attack: string;
  };
  /** (:138) */
  noVisitsLeft: string;
  /** (:146) */
  whoPrompt: string;
  /** (:204) {parlor} */
  frontNote: string;
  /** (:214) */
  self: string;
  /** (:227) {name} */
  online: string;
  /** (:241) {ride} {parlor} {name} */
  police: string;
  /** (:270) {other} {name} {he} */
  locked: string;
  /** (:287) {name} {ride} */
  outside: string;
  /** (:321) {parlor} */
  insideNote: string;
  /** (:329) {name} */
  inside: string;
  /** (:337) */
  safe: string;
  /** (:343) {name} {hp} */
  hitpoints: string;
  /** (:391) {strength} {picks} */
  padlockWithPicks: string;
  /** (:395) {strength} */
  padlock: string;
  /** (:433) */
  noPick: string;
  /** (:453) */
  lockBroken: string;
  /** Mail to the owner (:456). */
  lockBrokenMail: string;
  /** (:462) {damage} */
  lockPicked: string;
  /** Mail to the owner (:465). {damage} {strength} */
  lockPickedMail: string;
  /** (:554) */
  stealNothing: string;
  /** (:559) {type} */
  stealOne: string;
  /** (:563) {count} {type} */
  stealMany: string;
  /** (:571) */
  stealNone: string;
  /** (:578) {name} {his} {clothes} */
  caught: string;
  /** (:575-577) */
  pajamas: string;
  lingerie: string;
  /** Mail to the owner (:584). {name} */
  stealMail: string;
  /** (:589) {him} {count} {type} */
  stealMailOne: string;
  /** (:593) {him} {count} {type} */
  stealMailMany: string;
  /** (:598) {him} {he} */
  stealMailNothing: string;
  /** steal_random_caskets (:649-662), by tag tier. */
  tagTypes: string[];
}

export interface BattleText {
  /** (commands_battle.cpp:221) */
  note: string;
  /**
   * Battle cries (:243-253), picked with `random(6)`; the entry "{discount}"
   * is replaced by `discountMale` or `discountFemale` by the victim's sex. {name}
   */
  cries: string[];
  discountMale: string;
  discountFemale: string;
  /** (:256) {cry} {his} */
  scream: string;
  /** (:265) {name} */
  firstSwing: string;
  /** (:271) {name} {he} */
  theyKnew: string;
  /** (:302) {name} */
  sidestep: string;
  /** (:320) {name} {verb} {damage} */
  hitsYou: string;
  /** (:345) {name} */
  dodges: string;
  /** (:353) {name} {damage} */
  soulSmash: string;
  /** (:359) {verb} {name} {damage} */
  youHit: string;
  /** get_hit_type_me (:59-72) for damage 1-2, 3-4, ..., 13-14, then anything else. */
  verbsMe: string[];
  /** get_hit_type_him (:74-87). */
  verbsHim: string[];
  buttons: { run: string; attack: string; continue: string; leave: string };
  /** Mail header (:136, :401, :461). {name} */
  attackedMail: string;
  /** (:138) {HeCap} */
  ranOffMail: string;
  /** (:144) */
  run: string;
  /** (:403) */
  injuredMail: string;
  /** (:415) */
  nothingStolen: string;
  /** (:418) {count} {type} */
  oneStolen: string;
  /** (:419) {count} {type} */
  manyStolen: string;
  /** (:421, :474) {name} */
  hospitalTv: string;
  /** (:423) {bp} {stolen} */
  loseBpMail: string;
  /** (:433) {his} */
  pocketsNothing: string;
  /** (:436) {his} {count} {type} */
  pocketsOne: string;
  /** (:437) {his} {count} {type} */
  pocketsMany: string;
  /** (:439) {name} {bp} {pockets} */
  won: string;
  /** (:463) {his} */
  kickedAssMail: string;
  /** (:469) {bp} {day} */
  earnBpMail: string;
  /** (:480) {bp} */
  lost: string;
  /** (:496-500) {name} {bp} */
  faintedMail: string;
  /** Crime section (:509) {winner} {loser} */
  faintedCrime: string;
  /** (:551) */
  yellWinPrompt: string;
  /** (:579) {winner} {loser} */
  crimeWin: string;
  /** (:584) {winner} {loser} {quote} */
  crimeWinQuote: string;
  /** (:589) {name} {quote} */
  winQuoteMail: string;
  /** (:608) */
  yellLostPrompt: string;
  /** (:638) {winner} {loser} */
  crimeLost: string;
  /** (:643) {winner} {loser} {quote} */
  crimeLostQuote: string;
  /** (:650) {name} {him} {quote} */
  lostQuoteMail: string;
}

export interface CafeText {
  title: string;
  /** `init_location_info` name (commands_bar.cpp:327), shown by /all. */
  location: string;
  /** (:336-338) {names} */
  intro: string;
  /** (:66) */
  onlyOne: string;
  /** (:70) */
  othersHere: string;
  /** (:332) {name} */
  saunters: string;
  /** (:252-257) */
  help: string;
  /** (:30) */
  allHeader: string;
  /** (:32) */
  allRule: string;
  /** get_time_difference_in_text (not in the repository; get_uptime's format, maint.cpp:347-356). {n} */
  seconds: string;
  minutes: string;
  hours: string;
  tvIsOn: string;
  tvIsOff: string;
  tvTurnedOn: string;
  tvTurnedOff: string;
  /** (:147) {search} */
  giveNobody: string;
  /** (:164) */
  giveBadType: string;
  /** (:177) {name} {casket} */
  giveEmpty: string;
  /** (:187) {name} {casket} */
  giveSelf: string;
  /** (:198) {name} {target} {casket} */
  giveDisabled: string;
  /** (:206) {name} {target} {casket} {count} */
  giveLimit: string;
  /** (:219) {name} {target} {casket} */
  gave: string;
  /** (:233) {turns} {visits} {bpToday} {bp} {wood} {silver} {gold} */
  info: string;
  /** (:285) {name} {text} */
  me: string;
  /** Broadcast to everyone online (:292). {name} {text} */
  yell: string;
  /** (:382) {name} {text} */
  say: string;
  /** (:314) */
  unknown: string;
  /** A notice (simple text) read in the cafe (broadcast.cpp:129). {text} */
  notice: string;
  leave: string;
}

export interface MailText {
  /** Desk button (the pen icon of the original m_main). */
  writeLabel: string;
  /** Flash i_getname prompt for letters (welcome.swf button 396). */
  whoPrompt: string;
  /** Flash i_getname hint. */
  nameHint: string;
  /** Flash i_namenext (sprite 508). {name} */
  doYouMean: string;
  /** Flash i_namenext f_noname. */
  noName: string;
  /** Flash i_mail (sprite 456). */
  composePrompt: string;
  /** commands_send_mail.cpp:15 */
  noSuchPlayer: string;
  /** send_packet_mail (broadcast.cpp:264). {name} {text} */
  received: string;
  /** Asked when a letter offers Reply (the original's Reply and Continue buttons). */
  replyPrompt: string;
  /** commands_send_mail.cpp:28, a chat line if the recipient is in the cafe. */
  waiting: string;
}

export interface NewsExtraText {
  /** commands_news.cpp:146 */
  noCrime: string;
  buttons: {
    front: string;
    crime: string;
    yesterday: string;
    today: string;
    announce: string;
    continue: string;
  };
  /** Flash notepad (sprite 252). */
  announcePrompt: string;
  /** (:230) {name} {parlor} */
  announcementHeader: string;
}

export interface LobbyText {
  /** funeral.cpp:204 {day} {days} {online} {players} */
  tournament: string;
  /** funeral.cpp:215 */
  noWinner: string;
  /** funeral.cpp:219 {name} */
  over: string;
  /** funeral.cpp:227 {day} {online} {players} */
  endless: string;
  /** funeral.cpp:234 */
  dayZero: string;
  /** funeral.cpp:273: new accounts refused on the final day. */
  closedOver: string;
  /** funeral.cpp:278: new accounts refused on day 0. */
  closedDayZero: string;
}

export const CLASSIC_SOCIAL_TEXT: SocialText = {
  visit: {
    location: "Parlors",
    note: "A dense fog covers the row upon row of funeral homes. You see disturbed, emotionally unstable people trying to choose which parlor to patronize.  You fight the urge to hand out business cards, you have more important things to attend to.",
    watchNone: "You look at your watch, you should really get back to your parlor.\n",
    watchOne: "You look at your watch, you have time to visit `w1`$ more parlor today.\n",
    watchMany: "You look at your watch, you have time to visit `w{visits}`$ more parlors today.\n",
    buttons: {
      leave: "Leave",
      look: "Look",
      visit: "Visit",
      continue: "Continue",
      tryDoor: "Try Door",
      pickLock: "Pick Lock",
      steal: "Steal",
      attack: "Attack",
    },
    noVisitsLeft: "Is today look at everyone's parlor day?  No, it's not.  Maybe tomorrow.",
    whoPrompt: "`$Who's funeral home would you like to pay a little visit to?",
    frontNote:
      'You are standing in front of a funeral parlor.  The sign above the door proudly announces the name, "{parlor}". ',
    self: "This parlor looks strangely familiar.\n\nYou decide to go inside...",
    online:
      "You see {name} through the window talking earnestly to a young couple, perhaps later would be better...",
    police:
      "You park your {ride} a few blocks away from {parlor}.  As you approach you see {name} talking to some cops, maybe you should come back after things cool down.",
    locked:
      'As you take your position behind a bush, you are surprised to see {other} already sitting there.\n\n`w{other}: `$"Oh, hey {name}.  Tell ya what, {he}\'s mine first, ok?"\n\nYou agree to come back later.',
    outside:
      "The lights are off, the parlor is silent.  {name} must be sleeping inside.\n\nNobody seems to be looking, you could try the door-knob if you like.\n\nYou see a `w{ride}`$ parked nearby.",
    insideNote: "You have broken into {parlor}.",
    inside:
      "You quickly slip in and close the door.  You hear {name} softly snoring in the back room.",
    safe: "\n\nYou see a large combination `wSafe`$ in the corner.  You won't be able to steal tags.",
    hitpoints: "\n\nJudging from the room, you would guess {name} has `w{hp}`$ hitpoints.",
    padlockWithPicks:
      "There is a heavy padlock on the door at `w{strength} percent strength`y. What do you want to do?\n\nYou are holding `w{picks}`y lockpick(s).",
    padlock:
      "There is a heavy padlock on the door at `w{strength} percent strength`y.  What do you want to do?",
    noPick:
      "You attempt to pick the lock with your finger.  No go.  Perhaps if you had a real lockpick...",
    lockBroken:
      "As you are picking the lock the whole thing breaks and falls off!  Too bad your lockpick got stuck inside it.",
    lockBrokenMail: "`yYour padlock is `4damaged beyond repair`y by a prowler and falls off!",
    lockPicked:
      "`yYou successfully pick the lock.  Your lockpick breaks as you try to get it out which causes the padlock `w{damage}`y points of damage.",
    lockPickedMail:
      "`yYour padlock is weakened by `4{damage}`y down to `w{strength} percent strength`y by a prowler.",
    stealNothing: "You begin wildly opening drawers and things looking for anything of value.",
    stealOne: "You look around and find `w1 {type}`$ tag hidden on top of the refrigerator!",
    stealMany: "You look around and find `w{count} {type}`$ tags in a drawer!",
    stealNone: "You look around but can't find anything of value.",
    caught:
      "\n\nYou are startled by a noise behind you.  It's {name} in {his} {clothes}! You crash through a window and run like hell.",
    pajamas: "pajamas",
    lingerie: "lingerie",
    stealMail: "\n`wYou caught {name} sneaking around inside your parlor!`$\n",
    stealMailOne: "You scare {him} off.  You notice `w{count} {type} tag `$is missing.",
    stealMailMany: "You scare {him} off.  You notice `w{count} {type} tags `$are missing.",
    stealMailNothing: "You scare {him} off before {he} could steal anything.",
    tagTypes: ["wooden", "silver", "gold"],
  },
  battle: {
    note: "You are in battle.",
    cries: [
      "Stop stealing my customers!",
      "I will BURY you!",
      "Messing with me was a grave mistake, dear {name}.",
      "{discount}",
      "I was in this town first!",
      "You're an amateur! You don't belong here!",
    ],
    discountMale: "Discount this, bastard!",
    discountFemale: "Discount this, bitch!",
    scream: '`w"{cry}" `$you scream as you break into {his} room.\n\n',
    firstSwing: "{name} is completely surprised, you get first swing!\n\n",
    theyKnew: "{name}'s eyes flick open, {he} knew you were in the house!\n\n",
    sidestep: "{name} swings but you sidestep the blow.",
    hitsYou: "{name} {verb} you for `4{damage}`$ damage.",
    dodges: "{name} dodges your swing.",
    soulSmash: "You `wsoul smash`$ {name} for `4{damage}`$ damage!",
    youHit: "You {verb} {name} for `4{damage}`$ damage.",
    verbsMe: ["slap", "sock", "punch", "kick", "throw", "squeeze", "ninja", "slam"],
    verbsHim: ["slaps", "socks", "punches", "kicks", "throws", "squeezes", "ninja's", "slams"],
    buttons: { run: "Run", attack: "Attack", continue: "Continue", leave: "Leave" },
    attackedMail: "\n`wYou were attacked in your sleep by {name}!`$\n\n",
    ranOffMail: "{HeCap} got scared and ran off.\n\n",
    run: "You backflip through an open window and take off running.",
    injuredMail: "You are badly injured.  You vaguely remember riding in an ambulance.\n\n",
    nothingStolen: " Nothing was stolen.",
    oneStolen: " `w{count}`$ {type} tag was stolen from your pocket.",
    manyStolen: " `w{count}`$ {type} tags were stolen from your pockets.",
    hospitalTv: "It looks like {name} was taken to the hospital.",
    loseBpMail: "`$You lose `w{bp} `$Bury Points. {stolen}",
    pocketsNothing: "You go through {his} pockets but find nothing.",
    pocketsOne: "You go through {his} pockets and find `w{count} `${type} tag.",
    pocketsMany: "You go through {his} pockets and find `w{count} `${type} tags.",
    won: "{name} crumples to the floor. You have won the battle!\n\nYou earn `w{bp} `$Bury Points. {pockets}",
    kickedAssMail: "You woke up and kicked {his} ass!\n\n",
    earnBpMail: "`$You earn `w{bp} `$Bury Points. (applied to day {day})",
    lost: "You fall down, unable to get up.\n\nYou lose `w{bp} `$Bury Points.",
    faintedMail:
      "\n`wYou fainted while fighting {name}.`$\n\nYou vaguely remember riding in an ambulance.\n\n`$You lose `w{bp} `$Bury Points.",
    faintedCrime: "`8{winner} assaulted {loser} (who had fainted) in self defense!\r\n\r\n",
    yellWinPrompt:
      "`wYou hear police sirens in the distance... you can yell something as you leave or just hit ENTER to continue.",
    crimeWin: "`8{winner} brutally assaulted {loser}!\r\n\r\n",
    crimeWinQuote:
      '`8{winner} brutally assaulted {loser}!`6\r\n"{quote}" `8justified {winner}.\r\n\r\n',
    winQuoteMail:
      '`$While recovering you can\'t get what {name} yelled while escaping out of your head...\n\n`w"{quote}"`$',
    yellLostPrompt:
      "`wYou feel yourself being lifted into an ambulance.  Mutter something or just hit ENTER to continue.",
    crimeLost: "`8{winner} assaulted {loser} in self defense!\r\n\r\n",
    crimeLostQuote:
      '`8{winner} assaulted {loser} in self defense!`6\r\n"{quote}" `8moaned {loser} from the ambulance.\r\n\r\n',
    lostQuoteMail:
      '`$As {name} is leaving you hear {him} moaning from the ambulance...\n\n`w"{quote}"`$',
  },
  cafe: {
    title: "Pale Horse Cafe",
    location: "in cafe",
    intro:
      "`$The `wPale Horse `$has been here since before you can remember.  A great place to gossip or just sip a mochachino and watch tv.\n\nYou always wondered why they had that big glass bottle on the roof.\n\n{names}\nEnter /? for help.\n\n",
    onlyOne: "`$You are the only one here.",
    othersHere: "`$Other people here:",
    saunters: "`5{name} saunters in.",
    help: "\n** `$Cafe chat help **`w\n\n`w/yell `$to send a message to everyone\n`w/me`$ to do a custom action\n`w/all `$to see who is online now\n`w/give name tag_type `$to give a tag. Example: `w/give Seth gold\n`w/info `$to show how many BP's, turns and tags you have now.\n`w/tv on (or off) `$to control the cafe tv.\n",
    allHeader: "\n`wName                 Status            Last hit",
    allRule: "`$-----------------------------------------------",
    seconds: "{n} Sec",
    minutes: "{n} Min",
    hours: "{n} Hour(s)",
    tvIsOn: "`5The TV is currently on.",
    tvIsOff: "`5The TV is currently off, that stuff will rot your brain.",
    tvTurnedOn: "`5You turn the tv on.",
    tvTurnedOff: "`5You turn the tv off.",
    giveNobody:
      "`5You look around the room but don't see anyone with `w'{search}'`5 in their name.",
    giveBadType: "`5Valid tag types are wood, silver and gold.",
    giveEmpty: "`5{name} looks in his pocket for a {casket} tag but comes up empty.",
    giveSelf: "`5{name} absently tosses a {casket} tag into the air and catches it.",
    giveDisabled:
      "`5{name} is unable to give `w{target} `5a {casket} tag. (the admin has disabled tag transfer)",
    giveLimit:
      "`5{name} is unable to give `w{target} `5a {casket} tag. (he's already received {count} today)",
    gave: "`5{name} gives `w{target} `5a {casket} tag.",
    info: "`5You have `w{turns}`5 turns left today and `w{visits}`5 parlor visits.\nToday's BP's: `w{bpToday}`5, total BP's: `w{bp}`5.\nCasket tags: `w{wood}`5 Wood, `w{silver}`5 Silver, `w{gold}`5 Gold.",
    me: "`${name} {text}",
    yell: "{name} yells: {text}",
    say: "`${name}: `w{text}",
    unknown: "Unknown command.  Do /? for the list.",
    notice: "`w{text}",
    leave: "Leave",
  },
  mail: {
    writeLabel: "Write Letter",
    whoPrompt: "You get your pen and some paper.  Who would you like to mail?",
    nameHint: "(enter full or partial name)",
    doYouMean: "Do you mean {name}?",
    noName: "Sorry, nobody by that name lives around here!",
    composePrompt: "Please enter your text.",
    noSuchPlayer: "Can't email, player doesn't exist?",
    received: "`$You have received a letter from `w{name}`$:\n\n{text}",
    replyPrompt: "Reply to this letter?",
    waiting: "You have mail waiting for you at your parlor.",
  },
  news: {
    noCrime: "There has been no crime reported today.",
    buttons: {
      front: "Front Page",
      crime: "Crime",
      yesterday: "Yesterday",
      today: "Today",
      announce: "Make Announcement",
      continue: "Continue",
    },
    announcePrompt: "Please enter your text.",
    announcementHeader: "`8{name} of {parlor} makes an announcement:`6\r\n",
  },
  lobby: {
    tournament:
      "Game Info: Tournament Mode Active (day {day} of {days}) - {online} of {players} players on now.",
    noWinner: "New tournament starting tomorrow, please come back then!",
    over: "Game Info: Tournament is OVER, {name} declared winner.  New game starting tomorrow.",
    endless: "Game Info: No Reset Mode Active (day {day}) - {online} of {players} players on now.",
    dayZero:
      "A brand new game of FQ will be starting tomorrow! (Server will auto-reset at midnight)",
    closedOver: "A new game is starting tomorrow, please come back then!",
    closedDayZero: "A new game is starting tomorrow, please come back then! (Or midnight tonight!)",
  },
};
