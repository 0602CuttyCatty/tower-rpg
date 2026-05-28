import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════
// ELEMENT SYSTEM
// ═══════════════════════════════════════════════════════
const ELEMENTS = {
  fire:    { name:"화염", emoji:"🔥", color:"#ef4444", glow:"#ef444466" },
  ice:     { name:"빙결", emoji:"❄️", color:"#60a5fa", glow:"#60a5fa66" },
  thunder: { name:"번개", emoji:"⚡", color:"#fbbf24", glow:"#fbbf2466" },
  nature:  { name:"자연", emoji:"🌿", color:"#34d399", glow:"#34d39966" },
  dark:    { name:"암흑", emoji:"🌑", color:"#a78bfa", glow:"#a78bfa66" },
};

// 상성: key 속성이 value 속성에 강함 (1.5배 피해)
const ELEMENT_STRONG = {
  fire: "nature", ice: "thunder", thunder: "nature",
  nature: "dark", dark: "fire",
};
// 상성: key 속성이 value 속성에 약함 (0.7배 피해)
const ELEMENT_WEAK = {
  fire: "dark", ice: "fire", thunder: "ice",
  nature: "thunder", dark: "nature",
};

function getElementMult(atkElem, defElem) {
  if (!atkElem || !defElem) return 1;
  if (ELEMENT_STRONG[atkElem] === defElem) return 1.5;
  if (ELEMENT_WEAK[atkElem] === defElem) return 0.7;
  return 1;
}

// 콤보 시스템: 같은 속성 카드를 같은 턴에 연속 사용
const COMBO_EFFECTS = {
  fire:    { name:"화염 폭발", desc:"+8 추가피해, 적 방어도 무시",  bonus:(dmg)=>dmg+8, ignoreBlock:true },
  ice:     { name:"빙하 쇄도", desc:"모든 적 스턴",                 stunAll:true },
  thunder: { name:"번개 연쇄", desc:"+12 추가피해",                 bonus:(dmg)=>dmg+12 },
  nature:  { name:"자연 회복", desc:"HP +15 회복",                  heal:15 },
  dark:    { name:"암흑 공명", desc:"+10 피해 & 마나 +2",           bonus:(dmg)=>dmg+10, mana:2 },
};

// ═══════════════════════════════════════════════════════
// JOBS
// ═══════════════════════════════════════════════════════
const JOBS = {
  warrior: {
    id:"warrior", name:"전사", emoji:"⚔️",
    desc:"높은 HP와 방어력. 공격 카드 특화. 화염·암흑 속성 선호.",
    baseHp:120, baseMana:3, baseHandSize:5,
    perLevelHp:15, manaEveryNLevel:5, handEveryNLevel:8,
    color:"#ef4444",
    favElements:["fire","dark"],
    starterDeck:["slash","slash","slash","heavy_blow","heavy_blow","shield","shield","shield","dagger","dagger"],
    cardPool:["slash","heavy_blow","war_cry","shield","fortify","iron_skin","dagger","whirlwind","counter","shield_bash","berserker","armor_break","double_slash","retaliate","battle_shout",
              "fire_slash","magma_strike","dark_blade","inferno_cleave","shadow_crush","flame_shield","ember_strike","volcano_burst","dark_surge","hellfire"],
  },
  mage: {
    id:"mage", name:"마법사", emoji:"🔮",
    desc:"높은 마나와 강력한 마법. 번개·얼음 속성 선호.",
    baseHp:70, baseMana:5, baseHandSize:4,
    perLevelHp:8, manaEveryNLevel:4, handEveryNLevel:6,
    color:"#818cf8",
    favElements:["thunder","ice"],
    starterDeck:["fireball","fireball","mana_gem","mana_gem","arcane_bolt","arcane_bolt","ice_shard","blink","frost_nova","magic_shield"],
    cardPool:["fireball","arcane_bolt","ice_shard","frost_nova","blink","mana_gem","magic_shield","chain_lightning","meteor","time_warp","mana_surge","blizzard","arcane_explosion","spell_echo","void_ray",
              "thunder_bolt","storm_call","frozen_lance","ice_wall","lightning_strike","overcharge","static_field","absolute_zero","storm_surge","celestial_ray"],
  },
  rogue: {
    id:"rogue", name:"도적", emoji:"🗡️",
    desc:"빠른 손패와 콤보. 자연·암흑 속성 선호.",
    baseHp:90, baseMana:4, baseHandSize:6,
    perLevelHp:10, manaEveryNLevel:6, handEveryNLevel:5,
    color:"#34d399",
    favElements:["nature","dark"],
    starterDeck:["dagger","dagger","dagger","stab","stab","smoke_bomb","evasion","backstab","poison","quick_slash"],
    cardPool:["dagger","stab","backstab","poison","smoke_bomb","evasion","quick_slash","shadow_step","combo_strike","fan_of_knives","marked","hemorrhage","vanish","death_mark","knife_storm",
              "venom_blade","nature_step","thorn_strike","spore_bomb","shadow_fang","dark_rush","fungal_burst","poison_storm","natures_wrath","soul_rend"],
  },
  paladin: {
    id:"paladin", name:"성기사", emoji:"✨",
    desc:"회복과 방어 특화. 자연·화염 속성 선호.",
    baseHp:100, baseMana:3, baseHandSize:5,
    perLevelHp:12, manaEveryNLevel:5, handEveryNLevel:7,
    color:"#fbbf24",
    favElements:["nature","fire"],
    starterDeck:["holy_strike","holy_strike","shield","shield","heal","heal","blessing","divine_shield","smite","radiance"],
    cardPool:["holy_strike","smite","radiance","divine_shield","blessing","heal","sacred_ground","judgment","consecrate","holy_nova","shield_of_faith","aura_of_light","resurrection","holy_sword","divine_wrath",
              "solar_flare","verdant_vow","sacred_flame","nature_blessing","sun_lance","forest_ward","ember_faith","burning_judgment","life_bloom","genesis_wave"],
  },
};

function getJobStats(jobId, level) {
  const j = JOBS[jobId];
  return {
    maxHp:    j.baseHp + (j.perLevelHp||0) * (level-1),
    maxMana:  j.baseMana + Math.floor((level-1) / j.manaEveryNLevel),
    handSize: j.baseHandSize + Math.floor((level-1) / j.handEveryNLevel),
  };
}
function getJobBonuses(jobId, level) {
  const lv = level-1;
  return {
    warrior:  { atkBonus:Math.floor(lv*1.5), blockBonus:Math.floor(lv*2),   healBonus:0,              startGold:lv*10 },
    mage:     { atkBonus:Math.floor(lv*2.5), blockBonus:Math.floor(lv*0.5), healBonus:0,              startGold:lv*10 },
    rogue:    { atkBonus:Math.floor(lv*1.2), blockBonus:Math.floor(lv*0.8), healBonus:0,              startGold:lv*12 },
    paladin:  { atkBonus:Math.floor(lv*0.8), blockBonus:Math.floor(lv*1.5), healBonus:Math.floor(lv*1.5), startGold:lv*8 },
  }[jobId] || { atkBonus:0, blockBonus:0, healBonus:0, startGold:0 };
}

// ═══════════════════════════════════════════════════════
// CARDS (80+)
// ═══════════════════════════════════════════════════════
// effect 필드: dmg, times, block, heal, mana, stun, poison, bleed, mark,
//              break_armor, draw, extra_turn, self_dmg, all_enemies,
//              elem_infuse (속성 부여), drain_mana
// upgrades: 업그레이드 후 수치 (없으면 업그레이드 불가)
const ALL_CARDS = [
// ── 무속성 전사 ──
{id:"slash",       name:"베기",       cost:1,type:"attack", elem:null,   effect:{dmg:7},               desc:"7 피해",                     rarity:"common",  emoji:"⚔️", job:"warrior",  upgrades:{dmg:11}},
{id:"heavy_blow",  name:"강타",       cost:2,type:"attack", elem:null,   effect:{dmg:16},              desc:"16 피해",                    rarity:"common",  emoji:"🪓", job:"warrior",  upgrades:{dmg:24}},
{id:"double_slash",name:"연속 베기",  cost:2,type:"attack", elem:null,   effect:{dmg:8,times:2},       desc:"8×2 피해",                   rarity:"uncommon",emoji:"⚔️⚔️",job:"warrior",upgrades:{dmg:12,times:2}},
{id:"war_cry",     name:"전투 함성",  cost:1,type:"skill",  elem:null,   effect:{mana:1,block:4},      desc:"마나+1, 방어+4",             rarity:"common",  emoji:"📣", job:"warrior",  upgrades:{mana:2,block:6}},
{id:"counter",     name:"반격",       cost:1,type:"defense",elem:null,   effect:{block:6,dmg_next:4},  desc:"방어+6, 다음공격+4",         rarity:"uncommon",emoji:"🔄", job:"warrior",  upgrades:{block:10,dmg_next:8}},
{id:"shield_bash", name:"방패 강타",  cost:2,type:"attack", elem:null,   effect:{dmg:10,stun:1},       desc:"10 피해+스턴",               rarity:"uncommon",emoji:"🛡️⚔️",job:"warrior",upgrades:{dmg:16,stun:1}},
{id:"berserker",   name:"광전사",     cost:3,type:"attack", elem:null,   effect:{dmg:28,self_dmg:5},   desc:"28피해(자기5피해)",          rarity:"rare",    emoji:"😤", job:"warrior",  upgrades:{dmg:40,self_dmg:3}},
{id:"armor_break", name:"갑옷 파괴",  cost:2,type:"attack", elem:null,   effect:{dmg:8,break_armor:1}, desc:"8피해+방어도파괴",           rarity:"uncommon",emoji:"💥", job:"warrior",  upgrades:{dmg:14,break_armor:1}},
{id:"retaliate",   name:"응보",       cost:0,type:"attack", elem:null,   effect:{dmg:4},               desc:"무료! 4피해",                rarity:"common",  emoji:"↩️", job:"warrior",  upgrades:{dmg:8}},
{id:"battle_shout",name:"전투 외침",  cost:2,type:"skill",  elem:null,   effect:{block:10,draw:1},     desc:"방어+10, 드로우+1",          rarity:"uncommon",emoji:"🔊", job:"warrior",  upgrades:{block:16,draw:2}},
{id:"whirlwind",   name:"회오리 참격",cost:3,type:"attack", elem:null,   effect:{dmg:14,all_enemies:1},desc:"전체 14피해",                rarity:"rare",    emoji:"🌀", job:"warrior",  upgrades:{dmg:20,all_enemies:1}},
{id:"iron_skin",   name:"철의 피부",  cost:2,type:"defense",elem:null,   effect:{block:18},            desc:"방어+18",                    rarity:"uncommon",emoji:"🪨", job:"warrior",  upgrades:{block:28}},
// 속성 전사
{id:"fire_slash",    name:"화염 베기",    cost:1,type:"attack", elem:"fire",   effect:{dmg:8},               desc:"🔥8피해",                   rarity:"common",  emoji:"🔥⚔️",job:"warrior",upgrades:{dmg:13}},
{id:"magma_strike",  name:"용암 강타",    cost:2,type:"attack", elem:"fire",   effect:{dmg:14,bleed:1},      desc:"🔥14피해+출혈",             rarity:"uncommon",emoji:"🌋", job:"warrior",upgrades:{dmg:20,bleed:2}},
{id:"dark_blade",    name:"암흑 도검",    cost:2,type:"attack", elem:"dark",   effect:{dmg:12,poison:2},     desc:"🌑12피해+독2",              rarity:"uncommon",emoji:"🗡️🌑",job:"warrior",upgrades:{dmg:18,poison:3}},
{id:"inferno_cleave",name:"지옥 참격",   cost:3,type:"attack", elem:"fire",   effect:{dmg:18,all_enemies:1},desc:"🔥전체18피해",              rarity:"rare",    emoji:"🔥🪓",job:"warrior",upgrades:{dmg:26,all_enemies:1}},
{id:"shadow_crush",  name:"그림자 분쇄", cost:3,type:"attack", elem:"dark",   effect:{dmg:22,break_armor:1},desc:"🌑22피해+방어파괴",         rarity:"rare",    emoji:"👊🌑",job:"warrior",upgrades:{dmg:32,break_armor:1}},
{id:"flame_shield",  name:"화염 방패",   cost:2,type:"defense",elem:"fire",   effect:{block:12,dmg:4,all_enemies:1},desc:"🔥방어+12, 반사4피해",rarity:"uncommon",emoji:"🛡️🔥",job:"warrior",upgrades:{block:18,dmg:8,all_enemies:1}},
{id:"ember_strike",  name:"잿불 강타",   cost:1,type:"attack", elem:"fire",   effect:{dmg:6,draw:1},        desc:"🔥6피해+드로우",            rarity:"common",  emoji:"✨🔥",job:"warrior",upgrades:{dmg:10,draw:1}},
{id:"volcano_burst", name:"화산 폭발",   cost:4,type:"attack", elem:"fire",   effect:{dmg:30,all_enemies:1},desc:"🔥전체30피해",              rarity:"rare",    emoji:"🌋💥",job:"warrior",upgrades:{dmg:44,all_enemies:1}},
{id:"dark_surge",    name:"암흑 파동",   cost:2,type:"attack", elem:"dark",   effect:{dmg:10,all_enemies:1,mana:1},desc:"🌑전체10피해+마나+1",rarity:"uncommon",emoji:"🌑💫",job:"warrior",upgrades:{dmg:15,all_enemies:1,mana:1}},
{id:"hellfire",      name:"지옥불",      cost:5,type:"attack", elem:"fire",   effect:{dmg:45,all_enemies:1},desc:"🔥전체45피해(최강)",        rarity:"rare",    emoji:"🔥👿",job:"warrior",upgrades:{dmg:65,all_enemies:1}},

// ── 무속성 마법사 ──
{id:"fireball",      name:"파이어볼",    cost:2,type:"attack", elem:null,   effect:{dmg:14},              desc:"14피해",                     rarity:"common",  emoji:"🔥", job:"mage",   upgrades:{dmg:22}},
{id:"arcane_bolt",   name:"비전 화살",   cost:1,type:"attack", elem:null,   effect:{dmg:9},               desc:"9피해",                      rarity:"common",  emoji:"🔵", job:"mage",   upgrades:{dmg:14}},
{id:"ice_shard",     name:"얼음 파편",   cost:1,type:"attack", elem:null,   effect:{dmg:7,block:4},       desc:"7피해+방어+4",               rarity:"common",  emoji:"❄️", job:"mage",   upgrades:{dmg:11,block:7}},
{id:"frost_nova",    name:"서리 폭발",   cost:2,type:"attack", elem:null,   effect:{dmg:8,stun:1,all_enemies:1},desc:"전체8피해+스턴",       rarity:"uncommon",emoji:"❄️💥",job:"mage", upgrades:{dmg:12,stun:1,all_enemies:1}},
{id:"chain_lightning",name:"연쇄 번개", cost:3,type:"attack", elem:null,   effect:{dmg:13,all_enemies:1},desc:"전체13피해",                  rarity:"uncommon",emoji:"⚡", job:"mage",   upgrades:{dmg:20,all_enemies:1}},
{id:"meteor",        name:"운석 낙하",   cost:4,type:"attack", elem:null,   effect:{dmg:38},              desc:"38피해",                     rarity:"rare",    emoji:"☄️", job:"mage",   upgrades:{dmg:55}},
{id:"blink",         name:"순간이동",    cost:1,type:"defense",elem:null,   effect:{block:12},            desc:"방어+12",                    rarity:"common",  emoji:"🌀", job:"mage",   upgrades:{block:18}},
{id:"mana_gem",      name:"마나 결정",   cost:0,type:"skill",  elem:null,   effect:{mana:2},              desc:"마나+2(무료)",                rarity:"common",  emoji:"💎", job:"mage",   upgrades:{mana:3}},
{id:"magic_shield",  name:"마법 방패",   cost:2,type:"defense",elem:null,   effect:{block:14,draw:1},     desc:"방어+14+드로우",             rarity:"uncommon",emoji:"🔮", job:"mage",   upgrades:{block:22,draw:1}},
{id:"time_warp",     name:"시간 왜곡",   cost:3,type:"skill",  elem:null,   effect:{extra_turn:1},        desc:"마나+3 즉시충전",            rarity:"rare",    emoji:"⏰", job:"mage",   upgrades:{extra_turn:1,draw:1}},
{id:"mana_surge",    name:"마나 폭발",   cost:0,type:"skill",  elem:null,   effect:{mana:3,self_dmg:3},   desc:"마나+3(자기3피해)",          rarity:"uncommon",emoji:"💜", job:"mage",   upgrades:{mana:4,self_dmg:1}},
{id:"blizzard",      name:"눈보라",      cost:3,type:"attack", elem:null,   effect:{dmg:9,times:3},       desc:"9×3피해",                    rarity:"rare",    emoji:"🌨️", job:"mage",   upgrades:{dmg:13,times:3}},
{id:"arcane_explosion",name:"비전 폭발",cost:3,type:"attack", elem:null,   effect:{dmg:20,all_enemies:1},desc:"전체20피해",                  rarity:"uncommon",emoji:"💫", job:"mage",   upgrades:{dmg:30,all_enemies:1}},
{id:"spell_echo",    name:"주문 메아리", cost:2,type:"skill",  elem:null,   effect:{draw:2,mana:1},       desc:"드로우2+마나+1",             rarity:"uncommon",emoji:"🔁", job:"mage",   upgrades:{draw:3,mana:2}},
{id:"void_ray",      name:"공허 광선",   cost:3,type:"attack", elem:null,   effect:{dmg:22,break_armor:1},desc:"22피해+방어파괴",            rarity:"rare",    emoji:"🟣", job:"mage",   upgrades:{dmg:33,break_armor:1}},
// 속성 마법사
{id:"thunder_bolt",  name:"천둥벼락",    cost:2,type:"attack", elem:"thunder",effect:{dmg:15,stun:1},    desc:"⚡15피해+스턴",              rarity:"common",  emoji:"⚡", job:"mage",   upgrades:{dmg:22,stun:1}},
{id:"storm_call",    name:"폭풍 소환",   cost:3,type:"attack", elem:"thunder",effect:{dmg:12,all_enemies:1,stun:1},desc:"⚡전체12피해+스턴",rarity:"uncommon",emoji:"🌩️", job:"mage",   upgrades:{dmg:18,all_enemies:1,stun:1}},
{id:"frozen_lance",  name:"빙결 창",     cost:2,type:"attack", elem:"ice",   effect:{dmg:16,block:6},     desc:"❄️16피해+방어+6",           rarity:"common",  emoji:"🧊⚔️",job:"mage",  upgrades:{dmg:24,block:10}},
{id:"ice_wall",      name:"빙벽",        cost:2,type:"defense",elem:"ice",   effect:{block:20,stun:1},    desc:"❄️방어+20+적스턴",          rarity:"uncommon",emoji:"🧊🏰",job:"mage",  upgrades:{block:30,stun:1}},
{id:"lightning_strike",name:"낙뢰",     cost:1,type:"attack", elem:"thunder",effect:{dmg:10,draw:1},     desc:"⚡10피해+드로우",           rarity:"common",  emoji:"⚡🎯",job:"mage",  upgrades:{dmg:16,draw:1}},
{id:"overcharge",    name:"과부하",      cost:3,type:"skill",  elem:"thunder",effect:{mana:4,self_dmg:4}, desc:"⚡마나+4(자기4피해)",       rarity:"uncommon",emoji:"🔋💥",job:"mage",  upgrades:{mana:6,self_dmg:2}},
{id:"static_field",  name:"정전기장",    cost:2,type:"attack", elem:"thunder",effect:{dmg:8,all_enemies:1,poison:1},desc:"⚡전체8피해+독",rarity:"uncommon",emoji:"⚡🌐",job:"mage",  upgrades:{dmg:12,all_enemies:1,poison:2}},
{id:"absolute_zero", name:"절대영도",    cost:4,type:"attack", elem:"ice",   effect:{dmg:26,all_enemies:1,stun:1},desc:"❄️전체26피해+스턴",rarity:"rare",    emoji:"🌨️💀",job:"mage", upgrades:{dmg:38,all_enemies:1,stun:1}},
{id:"storm_surge",   name:"폭풍 해일",   cost:4,type:"attack", elem:"thunder",effect:{dmg:10,times:4},   desc:"⚡10×4 피해",               rarity:"rare",    emoji:"⛈️", job:"mage",   upgrades:{dmg:14,times:4}},
{id:"celestial_ray", name:"천상의 광선", cost:5,type:"attack", elem:"ice",   effect:{dmg:50,all_enemies:1},desc:"❄️전체50피해(극강)",       rarity:"rare",    emoji:"✨🌊",job:"mage",  upgrades:{dmg:72,all_enemies:1}},

// ── 무속성 도적 ──
{id:"dagger",        name:"단검",        cost:0,type:"attack", elem:null,   effect:{dmg:4},               desc:"무료! 4피해",                rarity:"common",  emoji:"🗡️", job:"rogue",  upgrades:{dmg:7}},
{id:"stab",          name:"찌르기",      cost:1,type:"attack", elem:null,   effect:{dmg:9},               desc:"9피해",                      rarity:"common",  emoji:"🔪", job:"rogue",  upgrades:{dmg:14}},
{id:"backstab",      name:"기습",        cost:2,type:"attack", elem:null,   effect:{dmg:20},              desc:"20피해",                     rarity:"uncommon",emoji:"🌑", job:"rogue",  upgrades:{dmg:30}},
{id:"poison",        name:"독 바르기",   cost:1,type:"skill",  elem:null,   effect:{poison:3},            desc:"독3 (매턴3피해)",            rarity:"common",  emoji:"☠️", job:"rogue",  upgrades:{poison:5}},
{id:"smoke_bomb",    name:"연막탄",      cost:1,type:"defense",elem:null,   effect:{block:8,draw:1},      desc:"방어+8+드로우",              rarity:"common",  emoji:"💨", job:"rogue",  upgrades:{block:14,draw:1}},
{id:"evasion",       name:"회피",        cost:1,type:"defense",elem:null,   effect:{block:14},            desc:"방어+14",                    rarity:"common",  emoji:"🏃", job:"rogue",  upgrades:{block:22}},
{id:"quick_slash",   name:"빠른 베기",   cost:1,type:"attack", elem:null,   effect:{dmg:6,draw:1},        desc:"6피해+드로우",               rarity:"common",  emoji:"💨⚔️",job:"rogue", upgrades:{dmg:10,draw:1}},
{id:"shadow_step",   name:"그림자 이동", cost:2,type:"skill",  elem:null,   effect:{block:10,mana:1},     desc:"방어+10+마나+1",             rarity:"uncommon",emoji:"👤", job:"rogue",  upgrades:{block:16,mana:2}},
{id:"combo_strike",  name:"콤보 연격",   cost:2,type:"attack", elem:null,   effect:{dmg:7,times:3},       desc:"7×3 피해",                   rarity:"uncommon",emoji:"🔱", job:"rogue",  upgrades:{dmg:10,times:3}},
{id:"fan_of_knives", name:"단검 세례",   cost:2,type:"attack", elem:null,   effect:{dmg:7,all_enemies:1}, desc:"전체7피해",                  rarity:"uncommon",emoji:"🗡️🗡️",job:"rogue",upgrades:{dmg:11,all_enemies:1}},
{id:"marked",        name:"표적 지정",   cost:1,type:"skill",  elem:null,   effect:{mark:1},              desc:"표적: 다음공격 +50%",        rarity:"uncommon",emoji:"🎯", job:"rogue",  upgrades:{mark:1,draw:1}},
{id:"hemorrhage",    name:"출혈",        cost:2,type:"attack", elem:null,   effect:{dmg:10,bleed:2},      desc:"10피해+출혈2",               rarity:"uncommon",emoji:"🩸", job:"rogue",  upgrades:{dmg:15,bleed:3}},
{id:"vanish",        name:"은신",        cost:2,type:"skill",  elem:null,   effect:{block:20},            desc:"방어+20",                    rarity:"rare",    emoji:"🌫️", job:"rogue",  upgrades:{block:30}},
{id:"death_mark",    name:"죽음의 낙인", cost:3,type:"attack", elem:null,   effect:{dmg:28,poison:2},     desc:"28피해+독2",                 rarity:"rare",    emoji:"💀", job:"rogue",  upgrades:{dmg:42,poison:3}},
{id:"knife_storm",   name:"단검 폭풍",   cost:4,type:"attack", elem:null,   effect:{dmg:9,times:5},       desc:"9×5 피해",                   rarity:"rare",    emoji:"🌩️", job:"rogue",  upgrades:{dmg:13,times:5}},
// 속성 도적
{id:"venom_blade",   name:"맹독 단검",   cost:1,type:"attack", elem:"nature", effect:{dmg:6,poison:4},   desc:"🌿6피해+독4",               rarity:"common",  emoji:"🌿🗡️",job:"rogue", upgrades:{dmg:10,poison:6}},
{id:"nature_step",   name:"자연의 발걸음",cost:1,type:"defense",elem:"nature",effect:{block:9,draw:1,heal:4},desc:"🌿방어+9+드로우+회복4",rarity:"common",  emoji:"🌿🏃",job:"rogue", upgrades:{block:14,draw:1,heal:7}},
{id:"thorn_strike",  name:"가시 공격",   cost:2,type:"attack", elem:"nature", effect:{dmg:12,bleed:2},   desc:"🌿12피해+출혈2",            rarity:"uncommon",emoji:"🌵", job:"rogue",  upgrades:{dmg:18,bleed:3}},
{id:"spore_bomb",    name:"포자 폭탄",   cost:2,type:"attack", elem:"nature", effect:{dmg:8,poison:3,all_enemies:1},desc:"🌿전체8피해+독3",rarity:"uncommon",emoji:"🍄💣",job:"rogue", upgrades:{dmg:12,poison:4,all_enemies:1}},
{id:"shadow_fang",   name:"그림자 이빨", cost:2,type:"attack", elem:"dark",  effect:{dmg:14,stun:1},      desc:"🌑14피해+스턴",             rarity:"uncommon",emoji:"🌑🦷",job:"rogue", upgrades:{dmg:20,stun:1}},
{id:"dark_rush",     name:"암흑 돌진",   cost:1,type:"attack", elem:"dark",  effect:{dmg:8,draw:1},       desc:"🌑8피해+드로우",            rarity:"common",  emoji:"🌑💨",job:"rogue", upgrades:{dmg:13,draw:1}},
{id:"fungal_burst",  name:"균사 폭발",   cost:3,type:"attack", elem:"nature", effect:{dmg:10,times:3,poison:1},desc:"🌿10×3피해+독",       rarity:"rare",    emoji:"🍄💥",job:"rogue", upgrades:{dmg:14,times:3,poison:2}},
{id:"poison_storm",  name:"독 폭풍",     cost:3,type:"skill",  elem:"nature", effect:{poison:8,all_enemies:1},desc:"🌿전체에 독8",          rarity:"rare",    emoji:"🌿🌀",job:"rogue", upgrades:{poison:12,all_enemies:1}},
{id:"natures_wrath", name:"자연의 분노", cost:4,type:"attack", elem:"nature", effect:{dmg:20,all_enemies:1,poison:3},desc:"🌿전체20피해+독3",rarity:"rare",   emoji:"🌿💢",job:"rogue", upgrades:{dmg:30,all_enemies:1,poison:4}},
{id:"soul_rend",     name:"영혼 약탈",   cost:3,type:"attack", elem:"dark",  effect:{dmg:24,poison:2,bleed:2},desc:"🌑24피해+독2+출혈2",    rarity:"rare",    emoji:"🌑💔",job:"rogue", upgrades:{dmg:36,poison:3,bleed:3}},

// ── 무속성 성기사 ──
{id:"holy_strike",   name:"성스러운 베기",cost:1,type:"attack",elem:null,   effect:{dmg:8,heal:2},        desc:"8피해+회복2",                rarity:"common",  emoji:"✝️", job:"paladin",upgrades:{dmg:12,heal:5}},
{id:"smite",         name:"천벌",         cost:2,type:"attack",elem:null,   effect:{dmg:16},              desc:"16피해",                     rarity:"common",  emoji:"⚡✝️",job:"paladin",upgrades:{dmg:25}},
{id:"radiance",      name:"광휘",         cost:1,type:"skill", elem:null,   effect:{heal:10},             desc:"HP+10",                      rarity:"common",  emoji:"☀️", job:"paladin",upgrades:{heal:16}},
{id:"divine_shield", name:"신성 방패",    cost:2,type:"defense",elem:null,  effect:{block:16},            desc:"방어+16",                    rarity:"common",  emoji:"🔆", job:"paladin",upgrades:{block:25}},
{id:"blessing",      name:"축복",         cost:1,type:"skill", elem:null,   effect:{block:6,heal:6},      desc:"방어+6+회복6",               rarity:"common",  emoji:"🌟", job:"paladin",upgrades:{block:10,heal:10}},
{id:"heal",          name:"치유",         cost:2,type:"skill", elem:null,   effect:{heal:16},             desc:"HP+16",                      rarity:"uncommon",emoji:"💚", job:"paladin",upgrades:{heal:25}},
{id:"sacred_ground", name:"성지",         cost:2,type:"skill", elem:null,   effect:{heal:8,block:8},      desc:"회복8+방어+8",               rarity:"uncommon",emoji:"🌸", job:"paladin",upgrades:{heal:13,block:13}},
{id:"judgment",      name:"심판",         cost:3,type:"attack",elem:null,   effect:{dmg:22,stun:1},       desc:"22피해+스턴",                rarity:"uncommon",emoji:"⚖️", job:"paladin",upgrades:{dmg:33,stun:1}},
{id:"consecrate",    name:"신성화",       cost:2,type:"attack",elem:null,   effect:{dmg:8,all_enemies:1,heal:4},desc:"전체8피해+회복4",      rarity:"uncommon",emoji:"🕊️", job:"paladin",upgrades:{dmg:13,all_enemies:1,heal:8}},
{id:"holy_nova",     name:"성스러운 폭발",cost:3,type:"attack",elem:null,   effect:{dmg:13,all_enemies:1,heal:8},desc:"전체13피해+회복8",    rarity:"rare",    emoji:"💥✨",job:"paladin",upgrades:{dmg:20,all_enemies:1,heal:13}},
{id:"shield_of_faith",name:"신앙의 방패",cost:2,type:"defense",elem:null,  effect:{block:20},            desc:"방어+20",                    rarity:"uncommon",emoji:"🛡️✨",job:"paladin",upgrades:{block:32}},
{id:"aura_of_light", name:"빛의 오라",    cost:3,type:"skill", elem:null,   effect:{heal:20,block:10},    desc:"회복20+방어+10",             rarity:"rare",    emoji:"🌠", job:"paladin",upgrades:{heal:30,block:16}},
{id:"resurrection",  name:"부활의 빛",    cost:4,type:"skill", elem:null,   effect:{heal:40},             desc:"HP+40 대회복",               rarity:"rare",    emoji:"🌅", job:"paladin",upgrades:{heal:60}},
{id:"holy_sword",    name:"성검 일격",    cost:3,type:"attack",elem:null,   effect:{dmg:28,heal:8},       desc:"28피해+회복8",               rarity:"rare",    emoji:"🗡️✨",job:"paladin",upgrades:{dmg:42,heal:14}},
{id:"divine_wrath",  name:"신성한 분노",  cost:4,type:"attack",elem:null,   effect:{dmg:40},              desc:"40피해",                     rarity:"rare",    emoji:"☀️⚔️",job:"paladin",upgrades:{dmg:60}},
// 속성 성기사
{id:"solar_flare",   name:"태양 섬광",    cost:2,type:"attack",elem:"fire",  effect:{dmg:13,all_enemies:1},desc:"🔥전체13피해",              rarity:"common",  emoji:"☀️🔥",job:"paladin",upgrades:{dmg:20,all_enemies:1}},
{id:"verdant_vow",   name:"초록의 맹세",  cost:1,type:"skill", elem:"nature",effect:{heal:8,block:6},     desc:"🌿회복8+방어+6",            rarity:"common",  emoji:"🌿✨",job:"paladin",upgrades:{heal:13,block:10}},
{id:"sacred_flame",  name:"성화",         cost:2,type:"attack",elem:"fire",  effect:{dmg:10,heal:6},      desc:"🔥10피해+회복6",            rarity:"uncommon",emoji:"🕯️", job:"paladin",upgrades:{dmg:16,heal:10}},
{id:"nature_blessing",name:"자연의 은총", cost:2,type:"skill", elem:"nature",effect:{heal:14,draw:1},     desc:"🌿회복14+드로우",           rarity:"uncommon",emoji:"🌿💚",job:"paladin",upgrades:{heal:22,draw:1}},
{id:"sun_lance",     name:"태양 창",      cost:3,type:"attack",elem:"fire",  effect:{dmg:24,break_armor:1},desc:"🔥24피해+방어파괴",         rarity:"rare",    emoji:"☀️🏹",job:"paladin",upgrades:{dmg:36,break_armor:1}},
{id:"forest_ward",   name:"숲의 수호",    cost:3,type:"defense",elem:"nature",effect:{block:22,heal:12},  desc:"🌿방어+22+회복12",          rarity:"rare",    emoji:"🌲🛡️",job:"paladin",upgrades:{block:34,heal:20}},
{id:"ember_faith",   name:"불꽃 신앙",    cost:1,type:"skill", elem:"fire",  effect:{mana:1,block:5,heal:3},desc:"🔥마나+1+방어+5+회복3",   rarity:"common",  emoji:"🔥💛",job:"paladin",upgrades:{mana:2,block:8,heal:6}},
{id:"burning_judgment",name:"불타는 심판",cost:3,type:"attack",elem:"fire",  effect:{dmg:20,stun:1,all_enemies:1},desc:"🔥전체20피해+스턴",rarity:"rare",    emoji:"🔥⚖️",job:"paladin",upgrades:{dmg:30,stun:1,all_enemies:1}},
{id:"life_bloom",    name:"생명 개화",    cost:3,type:"skill", elem:"nature",effect:{heal:30,draw:1},     desc:"🌿회복30+드로우",           rarity:"rare",    emoji:"🌸💚",job:"paladin",upgrades:{heal:45,draw:2}},
{id:"genesis_wave",  name:"창세의 파동",  cost:5,type:"attack",elem:"nature",effect:{dmg:18,all_enemies:1,heal:18},desc:"🌿전체18피해+회복18",rarity:"rare",  emoji:"🌿🌊",job:"paladin",upgrades:{dmg:27,all_enemies:1,heal:27}},

// ── 공용 ──
{id:"shield",        name:"방패",         cost:1,type:"defense",elem:null,   effect:{block:8},            desc:"방어+8",                     rarity:"common",  emoji:"🛡️", job:"any",   upgrades:{block:13}},
{id:"fortify",       name:"요새화",       cost:2,type:"defense",elem:null,   effect:{block:16},           desc:"방어+16",                    rarity:"uncommon",emoji:"🏰", job:"any",   upgrades:{block:25}},
{id:"potion",        name:"회복 포션",    cost:1,type:"skill",  elem:null,   effect:{heal:12},            desc:"HP+12",                      rarity:"common",  emoji:"🧪", job:"any",   upgrades:{heal:20}},
{id:"dragon_heart",  name:"용의 심장",    cost:5,type:"attack", elem:"fire",  effect:{dmg:55,all_enemies:1},desc:"🔥전체55피해",             rarity:"rare",    emoji:"🐉", job:"any",   upgrades:{dmg:80,all_enemies:1}},
{id:"thunder",       name:"천둥벼락",     cost:2,type:"attack", elem:"thunder",effect:{dmg:14,stun:1},   desc:"⚡14피해+스턴",              rarity:"uncommon",emoji:"⚡", job:"any",   upgrades:{dmg:21,stun:1}},
{id:"ice_spike",     name:"얼음 가시",    cost:1,type:"attack", elem:"ice",   effect:{dmg:8,block:4},     desc:"❄️8피해+방어+4",            rarity:"common",  emoji:"🧊", job:"any",   upgrades:{dmg:12,block:7}},
{id:"nature_surge",  name:"자연의 물결",  cost:2,type:"skill",  elem:"nature",effect:{heal:10,block:6},  desc:"🌿회복10+방어+6",           rarity:"common",  emoji:"🌿", job:"any",   upgrades:{heal:16,block:10}},
{id:"shadow_bolt",   name:"암흑 화살",    cost:1,type:"attack", elem:"dark",  effect:{dmg:9,poison:1},    desc:"🌑9피해+독1",               rarity:"common",  emoji:"🌑", job:"any",   upgrades:{dmg:14,poison:2}},
{id:"frost_armor",   name:"서리 갑옷",    cost:2,type:"defense",elem:"ice",   effect:{block:14,stun:1},   desc:"❄️방어+14+스턴",           rarity:"uncommon",emoji:"🧊🛡️",job:"any",  upgrades:{block:22,stun:1}},
{id:"dark_pact",     name:"암흑 계약",    cost:0,type:"skill",  elem:"dark",  effect:{mana:2,self_dmg:2}, desc:"🌑마나+2(자기2피해, 무료)",  rarity:"uncommon",emoji:"📜🌑",job:"any",  upgrades:{mana:3,self_dmg:1}},
];

// ═══════════════════════════════════════════════════════
// CARD HELPERS
// ═══════════════════════════════════════════════════════
const cardById = id => ALL_CARDS.find(c=>c.id===id);
const shuffle = arr => [...arr].sort(()=>Math.random()-.5);
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const pickN = (arr,n) => shuffle(arr).slice(0,n);
const RARITY_COLOR = {common:"#9ca3af",uncommon:"#34d399",rare:"#f59e0b"};
const TYPE_COLOR   = {attack:"#ef4444",defense:"#3b82f6",skill:"#a855f7"};

// 업그레이드된 카드 ID  (e.g. "fireball" → "fireball+")
const upgradedId = id => id.endsWith("+") ? id : id+"+";
const baseId     = id => id.endsWith("+") ? id.slice(0,-1) : id;
function getCard(id) {
  const isUp = id.endsWith("+");
  const base = ALL_CARDS.find(c=>c.id===baseId(id));
  if (!base) return null;
  if (!isUp) return base;
  if (!base.upgrades) return base;
  return { ...base, id: upgradedId(base.id), effect:{ ...base.effect, ...base.upgrades }, upgraded:true };
}

// ═══════════════════════════════════════════════════════
// ENEMIES
// ═══════════════════════════════════════════════════════
const ENEMY_TEMPLATES = [
  {id:"goblin",   name:"고블린",    emoji:"👺",elem:"nature",baseHp:28, reward:30, atkBase:[5,7],    blkBase:4,  healBase:0},
  {id:"orc",      name:"오크 전사", emoji:"👹",elem:"fire",  baseHp:50, reward:50, atkBase:[9,12,15],blkBase:8,  healBase:0},
  {id:"witch",    name:"마녀",      emoji:"🧙",elem:"dark",  baseHp:42, reward:55, atkBase:[11,14],  blkBase:0,  healBase:8},
  {id:"skeleton", name:"해골 기사", emoji:"💀",elem:"dark",  baseHp:38, reward:45, atkBase:[8,12],   blkBase:10, healBase:0},
  {id:"troll",    name:"트롤",      emoji:"👾",elem:"nature",baseHp:65, reward:65, atkBase:[14,18],  blkBase:12, healBase:10},
  {id:"vampire",  name:"뱀파이어",  emoji:"🧛",elem:"dark",  baseHp:55, reward:70, atkBase:[12,16],  blkBase:0,  healBase:0, drain:true},
  {id:"golem",    name:"석상 골렘", emoji:"🗿",elem:"nature",baseHp:80, reward:75, atkBase:[20,25],  blkBase:15, healBase:0},
  {id:"phoenix",  name:"불사조",    emoji:"🦅",elem:"fire",  baseHp:60, reward:80, atkBase:[15,18],  blkBase:0,  healBase:12},
  {id:"lich",     name:"리치",      emoji:"👻",elem:"ice",   baseHp:70, reward:90, atkBase:[16,20],  blkBase:14, healBase:6},
  {id:"demon",    name:"악마 병사", emoji:"👿",elem:"fire",  baseHp:90, reward:100,atkBase:[20,25],  blkBase:10, healBase:0},
  {id:"nightmare",name:"나이트메어",emoji:"🌑",elem:"dark",  baseHp:75, reward:110,atkBase:[22,28],  blkBase:0,  healBase:0, drain:true},
  {id:"warlord",  name:"마전사",    emoji:"⚔️",elem:"thunder",baseHp:100,reward:120,atkBase:[18,24,30],blkBase:20,healBase:0},
  // BOSSES
  {id:"dragon",       name:"드래곤",     emoji:"🐲",elem:"fire",  baseHp:120,reward:200,atkBase:[20,28,35],blkBase:20,healBase:0,  isBoss:true},
  {id:"demon_lord",   name:"마왕",       emoji:"😈",elem:"dark",  baseHp:180,reward:280,atkBase:[22,30,38],blkBase:18,healBase:15, isBoss:true},
  {id:"ancient_dragon",name:"고대 용",   emoji:"🔥🐉",elem:"fire",baseHp:250,reward:360,atkBase:[30,42,55],blkBase:28,healBase:0, isBoss:true},
  {id:"void_god",     name:"공허의 신",  emoji:"🌌",elem:"dark",  baseHp:320,reward:450,atkBase:[38,50,65],blkBase:35,healBase:20, isBoss:true},
  {id:"chaos_king",   name:"혼돈의 왕",  emoji:"👑💀",elem:"ice", baseHp:400,reward:600,atkBase:[45,60,80],blkBase:40,healBase:30, isBoss:true},
];

function floorMult(floor) { return Math.pow(1.035, floor-1); }
function scaleEnemy(template, floor) {
  const mult = floorMult(floor);
  const scaledHp   = Math.round(template.baseHp * mult);
  const scaledAtks = template.atkBase.map(v=>Math.round(v*mult));
  const scaledBlk  = template.blkBase ? Math.round(template.blkBase*mult*0.8) : 0;
  const scaledHeal = template.healBase ? Math.round(template.healBase*mult*0.7) : 0;
  const actions = [];
  scaledAtks.forEach(v=>actions.push({t:"atk",v}));
  if (scaledBlk>0)  actions.push({t:"blk", v:scaledBlk});
  if (scaledHeal>0) actions.push({t:"heal",v:scaledHeal});
  if (template.drain) actions.push({t:"drain",v:scaledAtks[0]});
  return {
    ...template,
    maxHp:scaledHp, hp:scaledHp, block:0,
    actions:shuffle(actions),
    reward:Math.round(template.reward*Math.sqrt(mult)),
    actionIdx:0, poisonStacks:0, bleedStacks:0, marked:false, stunned:false,
  };
}
function getEnemyGroup(floor) {
  const isBoss = floor%10===0;
  if (isBoss) {
    const bosses = ENEMY_TEMPLATES.filter(e=>e.isBoss);
    const idx = Math.min(Math.floor((floor/10-1)/4), bosses.length-1);
    return [scaleEnemy(bosses[idx], floor)];
  }
  const all = ENEMY_TEMPLATES.filter(e=>!e.isBoss);
  let pool = floor<20?all.slice(0,6):floor<50?all.slice(2,9):floor<100?all.slice(4,12):all.slice(6,12);
  const multiChance = Math.min(0.85, 0.15+floor*0.005);
  const tripleChance = Math.min(0.6, floor*0.003);
  if (floor>=5 && Math.random()<multiChance) {
    const count = (floor>=15&&Math.random()<tripleChance)?3:2;
    return pickN(pool,count).map(t=>scaleEnemy(t,floor));
  }
  return [scaleEnemy(pick(pool),floor)];
}
function generateFloorNodes(floor) {
  if (floor%10===0) return [{id:0,type:"boss",visited:false}];
  const options=["battle","battle","battle"];
  if (floor>1) options.push("shop");
  if (floor>2) options.push("rest");
  if (floor>10) options.push("elite");
  return shuffle(options).slice(0,3).map((t,i)=>({id:i,type:t,visited:false}));
}

// ═══════════════════════════════════════════════════════
// PERSISTENT DATA
// ═══════════════════════════════════════════════════════
const SAVE_KEY="realm_of_cards_v3";
function loadPermanent(){ try{ const r=localStorage.getItem(SAVE_KEY); return r?JSON.parse(r):{}; }catch{return{};} }
function savePermanent(d){ try{localStorage.setItem(SAVE_KEY,JSON.stringify(d));}catch{} }
function getPermanentJob(jobId){
  const a=loadPermanent();
  return a[jobId]||{level:1,xp:0,totalRuns:0,bestFloor:0,upgradePoints:0,upgradedCards:{}};
}
function setPermanentJob(jobId,data){ const a=loadPermanent(); a[jobId]=data; savePermanent(a); }

// 업그레이드 비용: 레벨 n→n+1 = 2n+1 포인트 (0→1:1, 1→2:3, 2→3:5, ...)
function upgradeCost(fromLevel){ return 2*fromLevel+1; }
// 카드의 현재 영구 업그레이드 레벨 가져오기
function getCardUpgradeLevel(upgradedCards, cardId){ return (upgradedCards||{})[baseId(cardId)]||0; }
// 영구 업그레이드된 카드ID 반환 (레벨 1이면 "+", 레벨 2이면 "++", ...)
function getPermCardId(upgradedCards, baseCardId){
  const lv=getCardUpgradeLevel(upgradedCards, baseCardId);
  return lv>0 ? baseCardId+"+" : baseCardId;  // 현재는 최대 1단계
}

// ═══════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════
function ElemBadge({elem,small}) {
  if (!elem) return null;
  const e = ELEMENTS[elem];
  return <span style={{fontSize:small?8:9,color:e.color,background:e.color+"20",borderRadius:3,padding:"1px 4px",fontWeight:700}}>{e.emoji}{e.name}</span>;
}

function CardComp({ cardId, playable, onClick, tiny, selected, dimmed }) {
  const c = getCard(cardId);
  if (!c) return null;
  const [hov, setHov] = useState(false);
  const elemData = c.elem ? ELEMENTS[c.elem] : null;
  const borderColor = selected?"#fbbf24":playable&&hov?(elemData?elemData.color:TYPE_COLOR[c.type]):"rgba(255,255,255,.1)";
  return (
    <div onClick={playable?onClick:undefined}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        width:tiny?64:100, minHeight:tiny?82:140,
        background:selected?"rgba(251,191,36,.15)":elemData?`rgba(10,8,25,.95)`:"rgba(10,8,25,.95)",
        border:`2px solid ${borderColor}`,
        borderRadius:9, padding:tiny?"5px 4px":"9px 7px",
        cursor:playable?"pointer":"default",
        display:"flex",flexDirection:"column",alignItems:"center",gap:2,
        position:"relative",flexShrink:0,
        transition:"transform .12s,box-shadow .12s,border-color .12s",
        boxShadow:playable&&hov?`0 0 16px ${elemData?elemData.glow:TYPE_COLOR[c.type]+"55"}`:"none",
        transform:playable&&hov&&!tiny?"translateY(-6px) scale(1.04)":"none",
        opacity:dimmed?.4:1,
      }}>
      {/* elem glow top bar */}
      {elemData&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:elemData.color,borderRadius:"9px 9px 0 0"}}/>}
      {/* cost */}
      <div style={{position:"absolute",top:tiny?3:5,right:tiny?3:5,width:tiny?14:20,height:tiny?14:20,borderRadius:"50%",
        background:"#1e1b4b",border:"1.5px solid #818cf8",display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:tiny?8:11,fontWeight:700,color:"#a5b4fc"}}>{c.cost}</div>
      {/* upgraded badge */}
      {c.upgraded&&<div style={{position:"absolute",top:tiny?3:5,left:tiny?3:5,fontSize:7,color:"#fbbf24",fontWeight:700}}>⬆</div>}
      <div style={{fontSize:tiny?18:26,lineHeight:1,marginTop:tiny?2:4}}>{c.emoji}</div>
      <div style={{fontSize:tiny?8:10,fontWeight:700,color:"#f1f5f9",textAlign:"center",lineHeight:1.15}}>{c.name}</div>
      {!tiny&&<div style={{fontSize:8,color:"#94a3b8",textAlign:"center",lineHeight:1.3}}>{c.desc}</div>}
      {!tiny&&c.elem&&<ElemBadge elem={c.elem}/>}
      <div style={{fontSize:tiny?7:8.5,marginTop:"auto",color:TYPE_COLOR[c.type],fontWeight:600,background:TYPE_COLOR[c.type]+"20",borderRadius:3,padding:"1px 4px"}}>
        {c.type==="attack"?"공격":c.type==="defense"?"방어":"스킬"}
      </div>
      <div style={{position:"absolute",bottom:tiny?3:5,left:tiny?3:5,fontSize:6.5,color:RARITY_COLOR[c.rarity],fontWeight:700}}>
        {c.rarity==="rare"?"★":c.rarity==="uncommon"?"◆":"·"}
      </div>
    </div>
  );
}

function HPBar({cur,max,color="#22c55e",thin}) {
  return <div style={{width:"100%",height:thin?6:9,background:"#0f172a",borderRadius:4,overflow:"hidden"}}>
    <div style={{width:`${Math.max(0,cur/max*100)}%`,height:"100%",background:color,transition:"width .3s",borderRadius:4}}/>
  </div>;
}
function XPBar({xp,needed}) {
  return <div style={{width:"100%",height:5,background:"#1e1b4b",borderRadius:3,overflow:"hidden"}}>
    <div style={{width:`${Math.min(100,xp/needed*100)}%`,height:"100%",background:"#818cf8",transition:"width .3s"}}/>
  </div>;
}
function FloatMsg({messages}) {
  return <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:10}}>
    {messages.map(m=><div key={m.id} style={{
      position:"absolute",left:`${m.x}%`,top:`${m.y}%`,
      color:m.color||"#fbbf24",fontWeight:800,fontSize:m.big?20:13,
      textShadow:"0 2px 6px #000",animation:"floatUp 1.3s ease-out forwards",
      whiteSpace:"nowrap",fontFamily:"'Cinzel',serif"
    }}>{m.text}</div>)}
  </div>;
}
function EnemyCard({enemy,isTarget,isActing,onClick,floats}) {
  const nextAction = enemy.stunned?null:enemy.actions[enemy.actionIdx%enemy.actions.length];
  const aIcon={atk:"⚔️",blk:"🛡️",heal:"💚",drain:"🩸"}[nextAction?.t]||"?";
  const aLabel=nextAction?(nextAction.t==="atk"?`${nextAction.v}공격`:nextAction.t==="blk"?`${nextAction.v}방어`:nextAction.t==="heal"?`${nextAction.v}회복`:`${nextAction.v}흡혈`):"😵스턴";
  const hpPct=enemy.hp/enemy.maxHp;
  const elemData=enemy.elem?ELEMENTS[enemy.elem]:null;
  const borderCol=isActing?"#f59e0b":isTarget?"#ef4444":"rgba(239,68,68,.2)";
  return (
    <div onClick={onClick} style={{flex:1,minWidth:0,background:"rgba(20,5,5,.85)",
      border:`2px solid ${borderCol}`,borderRadius:12,padding:"10px 12px",cursor:"pointer",position:"relative",
      boxShadow:isActing?"0 0 20px #f59e0b66":isTarget?"0 0 20px #ef444466":"none",
      transition:"border-color .15s,box-shadow .15s"}}>
      <FloatMsg messages={floats}/>
      {isActing&&<div style={{position:"absolute",top:-9,left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#f59e0b",background:"#1a1000",border:"1px solid #f59e0b",borderRadius:3,padding:"1px 7px",whiteSpace:"nowrap",fontWeight:700}}>⚡이번턴</div>}
      {isTarget&&!isActing&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#ef4444",background:"#1a0505",border:"1px solid #ef4444",borderRadius:3,padding:"1px 6px",whiteSpace:"nowrap"}}>▼대상</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <span style={{fontSize:11,fontWeight:700,color:"#fca5a5"}}>{enemy.emoji}{enemy.name}</span>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {elemData&&<span style={{fontSize:9,color:elemData.color}}>{elemData.emoji}</span>}
          <span style={{fontSize:10,color:"#9ca3af"}}>{Math.max(0,enemy.hp)}/{enemy.maxHp}</span>
        </div>
      </div>
      <HPBar cur={Math.max(0,enemy.hp)} max={enemy.maxHp} color={hpPct<.3?"#ef4444":hpPct<.6?"#f59e0b":"#22c55e"} thin/>
      <div style={{marginTop:4,display:"flex",gap:3,flexWrap:"wrap"}}>
        {enemy.block>0&&<span style={{fontSize:9,color:"#60a5fa",background:"#1e3a5f33",borderRadius:3,padding:"1px 4px"}}>🛡️{enemy.block}</span>}
        {enemy.poisonStacks>0&&<span style={{fontSize:9,color:"#a78bfa",background:"#4c1d9533",borderRadius:3,padding:"1px 4px"}}>☠️{enemy.poisonStacks}</span>}
        {enemy.bleedStacks>0&&<span style={{fontSize:9,color:"#f43f5e",background:"#9f123433",borderRadius:3,padding:"1px 4px"}}>🩸{enemy.bleedStacks}</span>}
        {enemy.marked&&<span style={{fontSize:9,color:"#fbbf24",background:"#78350f33",borderRadius:3,padding:"1px 4px"}}>🎯</span>}
        {enemy.stunned&&<span style={{fontSize:9,color:"#a78bfa",background:"#4c1d9533",borderRadius:3,padding:"1px 4px"}}>💫스턴</span>}
      </div>
      <div style={{marginTop:4,fontSize:9,color:isActing?"#f59e0b":"#6b7280",fontWeight:isActing?700:400}}>
        {aIcon}{isActing?"이번:":" 다음:"}{aLabel}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════
export default function App() {
  const [screen,setScreen]=useState("title");
  const [subScreen,setSubScreen]=useState(null); // "jobSelect"|"upgradeRoom"
  const [player,setPlayer]=useState(null);
  const [floor,setFloor]=useState(1);
  const [mapNodes,setMapNodes]=useState([]);
  const [battle,setBattle]=useState(null);
  const [floats,setFloats]=useState([]);
  const [log,setLog]=useState([]);
  const [rewardCards,setRewardCards]=useState([]);
  const [showReward,setShowReward]=useState(false);
  const [shopItems,setShopItems]=useState([]);
  const [boughtItems,setBoughtItems]=useState([]);
  const [showDeck,setShowDeck]=useState(false);
  const [permanentData,setPermanentData]=useState(()=>loadPermanent());
  const [upgradeJob,setUpgradeJob]=useState(null);
  const floatId=useRef(0);

  const addFloat=useCallback((text,eidx=-1,color="#fbbf24",big=false)=>{
    const id=++floatId.current;
    const x=eidx>=0?15+eidx*40:15;
    const y=eidx>=0?25:60;
    setFloats(f=>[...f,{id,eidx,text,x,y,color,big}]);
    setTimeout(()=>setFloats(f=>f.filter(m=>m.id!==id)),1400);
  },[]);
  const addLog=useCallback(msg=>setLog(l=>[msg,...l].slice(0,8)),[]);

  // XP
  function xpForLevel(lv){return lv*40;}
  function gainXP(p,amount){
    let np={...p,xp:p.xp+amount};
    // 업그레이드 포인트: XP 100마다 1포인트
    const newPts = Math.floor(amount/100);
    while(np.xp>=xpForLevel(np.level)){
      np.xp-=xpForLevel(np.level);
      np.level+=1;
      const stats=getJobStats(np.jobId,np.level);
      const hpGain=stats.maxHp-getJobStats(np.jobId,np.level-1).maxHp;
      np.maxHp=stats.maxHp; np.hp=Math.min(np.maxHp,np.hp+hpGain);
      np.maxMana=stats.maxMana; np.handSize=stats.handSize;
      const bon=getJobBonuses(np.jobId,np.level);
      addLog(`🆙 레벨UP! Lv.${np.level} HP:${np.maxHp} 마나:${np.maxMana} 공격+${bon.atkBonus} 방어+${bon.blockBonus}`);
    }
    const prev=getPermanentJob(np.jobId);
    const earnedPts = Math.max(newPts, Math.floor(amount/80)); // 전투 보상마다 포인트
    setPermanentJob(np.jobId,{
      level:np.level, xp:np.xp,
      totalRuns:prev.totalRuns||0, bestFloor:prev.bestFloor||0,
      upgradePoints:(prev.upgradePoints||0)+earnedPts,
      upgradedCards:prev.upgradedCards||{},
    });
    setPermanentData(loadPermanent());
    if(earnedPts>0) addLog(`✨ 업그레이드 포인트 +${earnedPts}P`);
    return np;
  }

  useEffect(()=>{ if(screen==="map") setMapNodes(generateFloorNodes(floor)); },[screen,floor]);

  function startGame(jobId){
    const j=JOBS[jobId];
    const perm=getPermanentJob(jobId);
    const lv=perm.level;
    const stats=getJobStats(jobId,lv);
    const bon=getJobBonuses(jobId,lv);
    // 영구 업그레이드 반영: 스타터 덱의 카드들을 업그레이드 상태로 변환
    const uc=perm.upgradedCards||{};
    const deck=j.starterDeck.map(id=>getPermCardId(uc,id));
    setPlayer({jobId,level:lv,xp:perm.xp,hp:stats.maxHp,maxHp:stats.maxHp,gold:80+bon.startGold,deck,maxMana:stats.maxMana,handSize:stats.handSize});
    setFloor(1); setLog([`⚔️ Lv.${lv} ${j.name} 시작! 업그레이드포인트:${perm.upgradePoints||0}P`]); setShowDeck(false);
    setScreen("map"); setSubScreen(null);
  }
  function recordRun(jobId,fl){
    const prev=getPermanentJob(jobId);
    setPermanentJob(jobId,{...prev,totalRuns:(prev.totalRuns||0)+1,bestFloor:Math.max(prev.bestFloor||0,fl)});
    setPermanentData(loadPermanent());
  }  function advanceFloor(){
    if(floor>=200){ recordRun(player.jobId,200); setScreen("win"); return; }
    setFloor(f=>f+1); setScreen("map");
  }
  function enterNode(node){
    setMapNodes(n=>n.map(x=>x.id===node.id?{...x,visited:true}:x));
    if(node.type==="battle"||node.type==="boss"||node.type==="elite"){
      startBattle(getEnemyGroup(floor),node.type==="boss");
    } else if(node.type==="shop"){
      const j=JOBS[player.jobId];
      const pool=[...j.cardPool,"shield","fortify","potion","thunder","ice_spike","nature_surge","shadow_bolt","frost_armor","dark_pact"];
      setShopItems(pickN([...new Set(pool)],6).map(id=>({id,price:getCard(id)?.rarity==="rare"?130:getCard(id)?.rarity==="uncommon"?75:45})));
      setBoughtItems([]); setScreen("shop");
    } else if(node.type==="rest"){
      const healed=Math.min(player.maxHp,player.hp+25);
      setPlayer(p=>({...p,hp:healed}));
      addLog(`⛺ 휴식 HP+${healed-player.hp}`);
      setTimeout(()=>advanceFloor(),800);
    }
  }

  // ─── BATTLE ───
  function startBattle(enemies,isBoss){
    const p=player;
    const deck=shuffle([...p.deck]);
    setBattle({enemies,targetIdx:0,actingEnemyIdx:0,playerBlock:0,mana:p.maxMana,maxMana:p.maxMana,
      hand:deck.slice(0,p.handSize),drawPile:deck.slice(p.handSize),discardPile:[],
      turn:1,ended:false,dmgBonus:0,lastElem:null,comboCount:{}});
    setScreen("battle");
    addLog(`${isBoss?"👑 보스":"⚔️"} 전투! ${enemies.map(e=>e.name).join(" + ")}`);
  }

  function playCard(handIdx){
    if(!battle||battle.ended) return;
    const cardId=battle.hand[handIdx];
    const c=getCard(cardId);
    if(!c||c.cost>battle.mana) return;

    let nb={...battle,comboCount:{...battle.comboCount}};
    nb.hand=battle.hand.filter((_,i)=>i!==handIdx);
    nb.discardPile=[...battle.discardPile,cardId];
    nb.mana-=c.cost;

    // 콤보 카운트
    let comboTriggered=null;
    if(c.elem){
      nb.comboCount[c.elem]=(nb.comboCount[c.elem]||0)+1;
      if(nb.comboCount[c.elem]===2){ comboTriggered=c.elem; nb.comboCount[c.elem]=0; }
    }

    let np={...player};
    let enemies=nb.enemies.map(e=>({...e}));
    const tIdx=nb.targetIdx<enemies.length?nb.targetIdx:0;
    const bon=getJobBonuses(player.jobId,player.level);

    const applyDmg=(idx,rawDmg,ignoreBlock=false)=>{
      const e=enemies[idx];
      const markBonus=e.marked?Math.floor(rawDmg*0.5):0;
      // 속성 상성
      const elemMult=getElementMult(c.elem,e.elem);
      let total=Math.round((rawDmg+markBonus+bon.atkBonus+nb.dmgBonus)*elemMult);
      nb.dmgBonus=0;
      const elemLabel=elemMult>1?"💥강점!":elemMult<1?"🔻약점":"";
      if(elemLabel) addLog(`${elemLabel} 속성 상성 ×${elemMult}`);
      const blocked=ignoreBlock?0:Math.min(e.block,total);
      e.block=Math.max(0,e.block-total);
      const actual=total-blocked;
      e.hp-=actual;
      addFloat(`-${actual}${elemLabel?elemLabel.slice(0,2):""}`,idx,"#ef4444",actual>25);
      addLog(`⚔️${c.name}→${e.name} ${actual}피해`);
    };

    // ATTACK
    if(c.effect.dmg){
      const times=c.effect.times||1;
      if(c.effect.all_enemies){
        for(let t=0;t<times;t++) enemies.forEach((_,i)=>applyDmg(i,c.effect.dmg));
      } else {
        for(let t=0;t<times;t++) applyDmg(tIdx,c.effect.dmg);
      }
    }
    if(c.effect.block){ const tot=c.effect.block+bon.blockBonus; nb.playerBlock=(nb.playerBlock||0)+tot; addFloat(`🛡️+${tot}`,-1,"#60a5fa"); addLog(`🛡️방어+${tot}`); }
    if(c.effect.heal){ const tot=c.effect.heal+bon.healBonus; np.hp=Math.min(np.maxHp,np.hp+tot); addFloat(`💚+${tot}`,-1,"#22c55e"); addLog(`💚회복+${tot}`); }
    if(c.effect.mana){ nb.mana=Math.min(nb.maxMana,nb.mana+c.effect.mana); addFloat(`💎+${c.effect.mana}`,-1,"#818cf8"); }
    if(c.effect.stun){
      if(c.effect.all_enemies) enemies.forEach(e=>{e.stunned=true;});
      else enemies[tIdx].stunned=true;
      addFloat("💫스턴!",c.effect.all_enemies?-1:tIdx,"#fbbf24");
    }
    if(c.effect.poison){ enemies[tIdx].poisonStacks=(enemies[tIdx].poisonStacks||0)+c.effect.poison; addFloat(`☠️+${c.effect.poison}`,tIdx,"#a78bfa"); }
    if(c.effect.bleed){ enemies[tIdx].bleedStacks=(enemies[tIdx].bleedStacks||0)+c.effect.bleed; addFloat(`🩸+${c.effect.bleed}`,tIdx,"#f43f5e"); }
    if(c.effect.mark){ enemies[tIdx].marked=true; addFloat("🎯표적!",tIdx,"#fbbf24"); }
    if(c.effect.break_armor){ enemies[tIdx].block=0; addFloat("💥방어파괴!",tIdx,"#fb923c"); }
    if(c.effect.draw){ for(let i=0;i<c.effect.draw;i++){ if(nb.drawPile.length===0){nb.drawPile=shuffle(nb.discardPile);nb.discardPile=[];} if(nb.drawPile.length>0){nb.hand=[...nb.hand,nb.drawPile[0]];nb.drawPile=nb.drawPile.slice(1);} } }
    if(c.effect.extra_turn){ nb.mana=Math.min(nb.maxMana,nb.mana+3); addFloat("⏰+3마나!",-1,"#f59e0b",true); }
    if(c.effect.self_dmg){ np.hp=Math.max(1,np.hp-c.effect.self_dmg); addFloat(`자기-${c.effect.self_dmg}`,-1,"#fb923c"); }

    // 콤보 발동!
    if(comboTriggered){
      const combo=COMBO_EFFECTS[comboTriggered];
      const cElem=ELEMENTS[comboTriggered];
      addLog(`✨ ${cElem.emoji}${combo.name} 콤보! ${combo.desc}`);
      addFloat(`${cElem.emoji}콤보!`,-1,cElem.color,true);
      if(combo.bonus){ const extraDmg=combo.bonus(0); const cBlock=combo.ignoreBlock?0:Math.min(enemies[tIdx].block,extraDmg); enemies[tIdx].block=Math.max(0,enemies[tIdx].block-extraDmg); enemies[tIdx].hp-=(extraDmg-cBlock); }
      if(combo.stunAll) enemies.forEach(e=>{e.stunned=true;});
      if(combo.heal){ np.hp=Math.min(np.maxHp,np.hp+combo.heal); addFloat(`💚+${combo.heal}`,-1,"#22c55e"); }
      if(combo.mana){ nb.mana=Math.min(nb.maxMana,nb.mana+combo.mana); }
    }

    enemies=enemies.filter(e=>e.hp>0);
    if(enemies.length===0){
      nb.enemies=[]; nb.ended=true;
      const totalReward=battle.enemies.reduce((s,e)=>s+e.reward,0);
      const xpGain=battle.enemies.reduce((s,e)=>Math.floor(s+e.reward/3),0);
      let np2=gainXP(np,xpGain); np2.gold+=totalReward;
      setBattle({...nb}); setPlayer(np2);
      addLog(`🏆 승리! +${totalReward}G +${xpGain}XP`);
      setTimeout(()=>offerReward(np2),700);
      return;
    }
    if(nb.targetIdx>=enemies.length) nb.targetIdx=0;
    nb.enemies=enemies;
    setBattle(nb); setPlayer(np);
  }

  function endTurn(){
    if(!battle||battle.ended) return;
    let nb={...battle}; let np={...player};
    let enemies=nb.enemies.map(e=>({...e}));
    let playerDied=false;

    // DOT
    enemies=enemies.map(e=>{
      let ne={...e};
      if(ne.poisonStacks>0){ne.hp-=ne.poisonStacks*2;addLog(`☠️${ne.name} 독${ne.poisonStacks*2}피해`);}
      if(ne.bleedStacks>0){ne.hp-=ne.bleedStacks*3;addLog(`🩸${ne.name} 출혈${ne.bleedStacks*3}피해`);ne.bleedStacks=Math.max(0,ne.bleedStacks-1);}
      return ne;
    }).filter(e=>e.hp>0);

    if(enemies.length===0){
      nb.ended=true;
      const tr=battle.enemies.reduce((s,e)=>s+e.reward,0);
      const xg=battle.enemies.reduce((s,e)=>Math.floor(s+e.reward/3),0);
      let np2=gainXP(np,xg); np2.gold+=tr;
      setBattle({...nb,enemies:[]}); setPlayer(np2);
      addLog(`🏆 승리! +${tr}G +${xg}XP`);
      setTimeout(()=>offerReward(np2),700); return;
    }

    // 한 명씩 행동
    const actIdx=nb.actingEnemyIdx%enemies.length;
    enemies=enemies.map((e,idx)=>{
      let ne={...e};
      if(idx!==actIdx) return ne;
      if(ne.stunned){addLog(`💫${ne.name} 스턴`);ne.stunned=false;ne.actionIdx=(ne.actionIdx+1)%ne.actions.length;return ne;}
      const action=ne.actions[ne.actionIdx%ne.actions.length];
      if(action.t==="atk"){const dmg=Math.max(0,action.v-nb.playerBlock);nb.playerBlock=Math.max(0,nb.playerBlock-action.v);np.hp-=dmg;addFloat(`-${dmg}`,-1,"#ef4444",dmg>18);addLog(`👹${ne.name} ${dmg}피해`);if(np.hp<=0)playerDied=true;}
      else if(action.t==="blk"){ne.block=(ne.block||0)+action.v;addLog(`🛡️${ne.name} 방어+${action.v}`);}
      else if(action.t==="heal"){ne.hp=Math.min(ne.maxHp,ne.hp+action.v);addLog(`💚${ne.name} 회복+${action.v}`);}
      else if(action.t==="drain"){const dmg=Math.max(0,action.v-nb.playerBlock);nb.playerBlock=Math.max(0,nb.playerBlock-action.v);np.hp-=dmg;ne.hp=Math.min(ne.maxHp,ne.hp+dmg);addLog(`🩸${ne.name} 흡혈${dmg}`);if(np.hp<=0)playerDied=true;}
      ne.actionIdx=(ne.actionIdx+1)%ne.actions.length; return ne;
    });
    nb.actingEnemyIdx=(actIdx+1)%enemies.length;

    if(playerDied){
      const prev=getPermanentJob(np.jobId);
      setPermanentJob(np.jobId,{level:np.level,xp:np.xp,totalRuns:(prev.totalRuns||0)+1,bestFloor:Math.max(prev.bestFloor||0,floor)});
      setPermanentData(loadPermanent());
      setPlayer({...np,hp:0}); setBattle({...nb,ended:true,enemies});
      setTimeout(()=>setScreen("gameover"),900); return;
    }

    nb.playerBlock=0;
    const discardAll=[...nb.discardPile,...nb.hand];
    let draw=[...nb.drawPile];
    if(draw.length<np.handSize){draw=shuffle([...draw,...discardAll]);nb.discardPile=[];}
    else nb.discardPile=discardAll;
    nb.hand=draw.slice(0,np.handSize); nb.drawPile=draw.slice(np.handSize);
    nb.mana=nb.maxMana; nb.turn+=1; nb.enemies=enemies;
    nb.comboCount={};  // 턴 종료 시 콤보 리셋
    if(nb.targetIdx>=enemies.length) nb.targetIdx=0;
    setBattle(nb); setPlayer(np);
  }

  // ─── REWARD (카드 선택만) ───
  function offerReward(np){
    const p=np||player;
    const j=JOBS[p.jobId];
    const pool=[...new Set([...j.cardPool,"shield","fortify","potion","thunder","ice_spike","nature_surge","shadow_bolt","frost_armor","dark_pact"])];
    setRewardCards(pickN(pool,3));
    setShowReward(true);
  }
  function pickReward(cardId){
    if(cardId) setPlayer(p=>({...p,deck:[...p.deck,cardId]}));
    setShowReward(false);
    advanceFloor();
  }

  // ─── SHOP ───
  function buyCard(item){
    if(player.gold<item.price||boughtItems.includes(item.id)) return;
    setPlayer(p=>({...p,gold:p.gold-item.price,deck:[...p.deck,item.id]}));
    setBoughtItems(b=>[...b,item.id]);
    addLog(`🛒${getCard(item.id)?.name} 구매(-${item.price}G)`);
  }

  // ─── STYLES ───
  const GS=`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');
    @keyframes floatUp{to{transform:translateY(-55px);opacity:0}}
    @keyframes glow{0%,100%{text-shadow:0 0 20px #818cf8,0 0 40px #4f46e5}50%{text-shadow:0 0 40px #a78bfa,0 0 80px #7c3aed}}
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#312e81}
    button{font-family:'Cinzel',serif;touch-action:manipulation}
    body{overscroll-behavior:none;overflow-x:hidden;max-width:100vw}
  `;

  // ─── TITLE ───
  if(screen==="title") return (
    <div style={{minHeight:"100vh",background:"#030712",fontFamily:"'Cinzel',serif",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      backgroundImage:"radial-gradient(ellipse at 50% 0%,#1e1040 0%,#030712 65%)",
      padding:"12px 14px",overflowY:"auto"}}>
      <style>{GS}</style>
      <div style={{fontSize:44,marginBottom:2}}>⚔️🐉🔮</div>
      <h1 style={{fontSize:"clamp(13px,3.8vw,22px)",fontWeight:900,color:"#e0d7ff",margin:0,letterSpacing:"clamp(0px,.3vw,2px)",animation:"glow 3s ease-in-out infinite",textAlign:"center",lineHeight:1.35,wordBreak:"keep-all",maxWidth:400}}>갑자기 도시 한복판에 나타난<br/>정체불명의 탑을 제가 정복하라고요? RPG</h1>
      <p style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",color:"#7c6fcd",fontSize:"clamp(11px,3vw,15px)",marginTop:4,letterSpacing:1,textAlign:"center"}}>
        200층짜리 탑 · 카드 덱빌딩 RPG
      </p>
      {/* 속성 상성표 */}
      <div style={{marginTop:10,background:"rgba(255,255,255,.03)",border:"1px solid #2d2a5e",borderRadius:12,padding:"10px 12px",maxWidth:400,width:"100%"}}>
        <div style={{color:"#6b7280",fontSize:9,marginBottom:5,textAlign:"center"}}>속성 상성 (강점 ×1.5 / 약점 ×0.7)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center"}}>
          {Object.entries(ELEMENT_STRONG).map(([atk,def])=>{
            const a=ELEMENTS[atk],d=ELEMENTS[def];
            return <span key={atk} style={{fontSize:9,color:"#94a3b8",background:"rgba(255,255,255,.05)",borderRadius:4,padding:"2px 5px"}}>{a.emoji}{a.name}→{d.emoji}{d.name}</span>;
          })}
        </div>
        <div style={{marginTop:6,fontSize:8.5,color:"#4b5563",textAlign:"center"}}>같은 속성 2장 연속 → 콤보 발동!</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center",marginTop:3}}>
          {Object.entries(COMBO_EFFECTS).map(([el,c])=>{
            const e=ELEMENTS[el];
            return <span key={el} style={{fontSize:8,color:e.color,background:e.color+"15",borderRadius:4,padding:"1px 5px"}}>{e.emoji}{c.name}: {c.desc}</span>;
          })}
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:10,width:"100%",maxWidth:400}}>
        <button onClick={()=>setSubScreen("jobSelect")} style={{flex:1,padding:"13px 0",fontSize:"clamp(12px,3.5vw,15px)",fontWeight:700,letterSpacing:1,border:"2px solid #6d28d9",background:"linear-gradient(135deg,#4c1d95,#1e1b4b)",color:"#e0d7ff",borderRadius:12,cursor:"pointer",boxShadow:"0 0 30px #4c1d9566"}}>⚔️ 모험 시작</button>
        <button onClick={()=>{setUpgradeJob(Object.keys(JOBS)[0]);setSubScreen("upgradeRoom");}} style={{flex:1,padding:"13px 0",fontSize:"clamp(12px,3.5vw,15px)",fontWeight:700,letterSpacing:1,border:"2px solid #d97706",background:"linear-gradient(135deg,#78350f,#1e1b4b)",color:"#fde68a",borderRadius:12,cursor:"pointer",boxShadow:"0 0 20px #d9770633"}}>⬆️ 업그레이드</button>
      </div>

      {/* 직업 선택 */}
      {subScreen==="jobSelect"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16,overflowY:"auto"}}>
          <div style={{background:"#0d0b1e",border:"1px solid #3730a3",borderRadius:16,padding:24,maxWidth:540,width:"100%"}}>
            <h3 style={{color:"#e0d7ff",margin:"0 0 14px",textAlign:"center",fontSize:17,letterSpacing:2}}>직업 선택</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {Object.values(JOBS).map(j=>{
                const perm=permanentData[j.id]||{level:1,xp:0,totalRuns:0,bestFloor:0};
                const lv=perm.level; const bon=getJobBonuses(j.id,lv); const stats=getJobStats(j.id,lv);
                return (
                  <button key={j.id} onClick={()=>{setSubScreen(null);startGame(j.id);}}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"rgba(255,255,255,.04)",border:`1.5px solid ${j.color}44`,borderRadius:10,cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=j.color}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=j.color+"44"}>
                    <span style={{fontSize:28}}>{j.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{color:j.color,fontWeight:700,fontSize:13}}>{j.name}</span>
                        <span style={{fontSize:10,color:"#fbbf24",background:"#78350f33",borderRadius:4,padding:"1px 5px"}}>Lv.{lv}</span>
                        {perm.bestFloor>0&&<span style={{fontSize:9,color:"#6b7280"}}>최고{perm.bestFloor}층</span>}
                        <span style={{fontSize:9,color:"#4b5563"}}>선호: {j.favElements.map(e=>ELEMENTS[e].emoji).join("")}</span>
                      </div>
                      <div style={{color:"#6b7280",fontSize:10,fontFamily:"sans-serif",marginTop:1}}>{j.desc}</div>
                      <div style={{color:"#4b5563",fontSize:9,fontFamily:"sans-serif",marginTop:2}}>HP{stats.maxHp} 마나{stats.maxMana} 패{stats.handSize} 시작{80+bon.startGold}G</div>
                      {lv>1&&<div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                        {bon.atkBonus>0&&<span style={{fontSize:8,color:"#ef4444",background:"#450a0a",borderRadius:3,padding:"1px 4px"}}>⚔️+{bon.atkBonus}</span>}
                        {bon.blockBonus>0&&<span style={{fontSize:8,color:"#60a5fa",background:"#0c1a2e",borderRadius:3,padding:"1px 4px"}}>🛡️+{bon.blockBonus}</span>}
                        {bon.healBonus>0&&<span style={{fontSize:8,color:"#22c55e",background:"#052e16",borderRadius:3,padding:"1px 4px"}}>💚+{bon.healBonus}</span>}
                      </div>}
                    </div>
                    {perm.totalRuns>0&&<div style={{fontSize:9,color:"#4b5563",textAlign:"right",fontFamily:"sans-serif"}}>{perm.totalRuns}회</div>}
                  </button>
                );
              })}
            </div>
            <button onClick={()=>setSubScreen(null)} style={{marginTop:12,width:"100%",padding:"8px",background:"transparent",border:"1px solid #2d2a5e",color:"#6b7280",borderRadius:8,cursor:"pointer",fontSize:12}}>닫기</button>
          </div>
        </div>
      )}

      {/* 카드 영구 업그레이드 방 */}
      {subScreen==="upgradeRoom"&&(()=>{
        const selJob = upgradeJob || Object.keys(JOBS)[0];
        const perm = permanentData[selJob]||{upgradePoints:0,upgradedCards:{}};
        const pts = perm.upgradePoints||0;
        const uc = perm.upgradedCards||{};
        const j = JOBS[selJob];
        const jobCardIds = [...new Set([...j.starterDeck,...j.cardPool,"shield","fortify","potion","thunder","ice_spike","nature_surge","shadow_bolt","frost_armor","dark_pact"])];
        // 중복 제거: 각 baseId 한 번씩만
        const seenIds = new Set();
        const upgCards = ALL_CARDS.filter(c=>{
          if(!c.upgrades) return false;
          if(!jobCardIds.includes(c.id)) return false;
          if(seenIds.has(c.id)) return false;
          seenIds.add(c.id);
          return true;
        });

        function doUpgrade(cardId){
          const curLv=getCardUpgradeLevel(uc,cardId);
          const cost=upgradeCost(curLv);
          if(pts<cost) return;
          const newUc={...uc,[cardId]:curLv+1};
          setPermanentJob(selJob,{...perm,upgradePoints:pts-cost,upgradedCards:newUc});
          setPermanentData(loadPermanent());
        }

        // 업그레이드 전후 수치 비교 텍스트
        function diffText(base, up) {
          const LABELS = {
            dmg:"피해", block:"방어", heal:"회복", mana:"마나",
            poison:"독", bleed:"출혈", times:"횟수", draw:"드로우",
            self_dmg:"자기피해", dmg_next:"다음공격+", break_armor:"방어파괴",
            all_enemies:"전체공격", extra_turn:"추가마나", stun:"스턴",
            mark:"표적", drain:"흡혈",
          };
          const diffs = [];
          for(const k of Object.keys(up.effect)) {
            const bv = base.effect[k]||0;
            const uv = up.effect[k]||0;
            if(uv !== bv) {
              const label = LABELS[k] || k;
              diffs.push(`${label} ${bv}→${uv}`);
            }
          }
          return diffs.join(" / ");
        }

        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:100,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
            <div style={{background:"#0d0b1e",border:"1px solid #92400e",borderRadius:16,padding:"16px 12px",width:"100%",maxWidth:640,margin:"8px auto",minHeight:"100%"}}>
              {/* 헤더 */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,position:"sticky",top:0,background:"#0d0b1e",zIndex:1,paddingBottom:6,borderBottom:"1px solid #1e1b4b"}}>
                <h3 style={{color:"#fde68a",margin:0,fontSize:15,letterSpacing:1}}>⬆️ 카드 영구 업그레이드</h3>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,color:"#fbbf24",fontWeight:700,background:"#451a03",borderRadius:6,padding:"3px 8px"}}>✨{pts}P</span>
                  <button onClick={()=>setSubScreen(null)} style={{background:"#1e1b4b",border:"1px solid #4b5563",color:"#9ca3af",borderRadius:6,cursor:"pointer",padding:"5px 10px",fontSize:12}}>✕</button>
                </div>
              </div>
              <p style={{color:"#6b7280",fontFamily:"sans-serif",fontSize:10,margin:"0 0 10px",textAlign:"center",lineHeight:1.5}}>
                0→1: 1P · 1→2: 3P · 2→3: 5P · n→n+1: (2n+1)P<br/>
                업그레이드된 카드는 다음 게임 스타터 덱에 반영됩니다
              </p>
              {/* 직업 탭 */}
              <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
                {Object.values(JOBS).map(jb=>{
                  const jp=permanentData[jb.id]||{upgradePoints:0};
                  return (
                    <button key={jb.id} onClick={()=>setUpgradeJob(jb.id)}
                      style={{flexShrink:0,padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,
                        background:selJob===jb.id?jb.color+"33":"rgba(255,255,255,.03)",
                        border:`2px solid ${selJob===jb.id?jb.color:jb.color+"22"}`,
                        color:selJob===jb.id?jb.color:"#6b7280",whiteSpace:"nowrap"}}>
                      {jb.emoji} {jb.name}<br/>
                      <span style={{fontSize:9,opacity:.8}}>✨{jp.upgradePoints||0}P</span>
                    </button>
                  );
                })}
              </div>
              {/* 카드 그리드 — 모바일 2열, 데스크탑 3열 */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                {upgCards.map(c=>{
                  const curLv=getCardUpgradeLevel(uc,c.id);
                  const cost=upgradeCost(curLv);
                  const canUpgrade=pts>=cost&&curLv===0;
                  const done=curLv>0;
                  const baseC=c;
                  const upC=getCard(upgradedId(c.id));
                  const diff=upC?diffText(baseC,upC):"";
                  const dispId=done?upgradedId(c.id):c.id;
                  return (
                    <div key={c.id} style={{
                      background:done?"rgba(251,191,36,.06)":"rgba(255,255,255,.03)",
                      border:`1.5px solid ${done?"#d97706":canUpgrade?"#4338ca":"#1e1b4b"}`,
                      borderRadius:10,padding:"10px 8px",
                      display:"flex",flexDirection:"column",alignItems:"center",gap:6
                    }}>
                      {/* 카드 한 장만 */}
                      <CardComp cardId={dispId} tiny/>
                      {/* 업그레이드 전후 비교 */}
                      {!done&&diff&&(
                        <div style={{fontSize:8.5,color:"#34d399",fontFamily:"sans-serif",textAlign:"center",lineHeight:1.4,background:"rgba(52,211,153,.08)",borderRadius:4,padding:"2px 5px",width:"100%"}}>
                          {diff}
                        </div>
                      )}
                      {done
                        ? <div style={{fontSize:9,color:"#fbbf24",fontWeight:700}}>✅ 완료</div>
                        : <button onClick={()=>doUpgrade(c.id)} disabled={!canUpgrade}
                            style={{width:"100%",padding:"6px 0",borderRadius:6,
                              cursor:canUpgrade?"pointer":"default",
                              background:canUpgrade?"#451a03":"#111",
                              border:`1px solid ${canUpgrade?"#d97706":"#374151"}`,
                              color:canUpgrade?"#fde68a":"#4b5563",
                              fontSize:10,fontWeight:700}}>
                            {cost}P 업그레이드
                          </button>
                      }
                    </div>
                  );
                })}
              </div>
              {upgCards.length===0&&<p style={{color:"#4b5563",textAlign:"center",fontFamily:"sans-serif",fontSize:12,marginTop:20}}>업그레이드 가능한 카드가 없습니다</p>}
              <div style={{height:16}}/>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ─── GAME OVER ───
  if(screen==="gameover"){
    const perm=player?(permanentData[player.jobId]||{level:1,xp:0}):null;
    const bon=player?getJobBonuses(player.jobId,player.level):null;
    return (
      <div style={{minHeight:"100vh",background:"#030712",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Cinzel',serif",padding:"16px 14px",textAlign:"center"}}>
        <style>{GS}</style>
        <div style={{fontSize:"clamp(50px,15vw,70px)"}}>💀</div>
        <h2 style={{fontSize:"clamp(24px,7vw,32px)",color:"#ef4444",fontWeight:900,letterSpacing:"clamp(2px,1vw,4px)",margin:"8px 0"}}>GAME OVER</h2>
        <p style={{color:"#9ca3af",fontFamily:"sans-serif",margin:"4px 0"}}>Floor {floor}에서 쓰러졌습니다...</p>
        {player&&<p style={{color:"#6b7280",fontFamily:"sans-serif",fontSize:12,margin:"2px 0"}}>Lv.{player.level} {JOBS[player.jobId]?.name} · {player.gold}G</p>}
        {perm&&player&&(
          <div style={{background:"rgba(251,191,36,.08)",border:"1px solid #78350f",borderRadius:12,padding:"12px 16px",margin:"12px 0",maxWidth:280,width:"100%"}}>
            <div style={{color:"#fbbf24",fontWeight:700,fontSize:12,marginBottom:4}}>💾 레벨 유지됨!</div>
            <div style={{color:"#d1fae5",fontFamily:"sans-serif",fontSize:11}}>다음 시작 시 <strong style={{color:"#fbbf24"}}>Lv.{player.level}</strong> 에서 출발</div>
            {bon&&bon.atkBonus>0&&<div style={{color:"#fca5a5",fontFamily:"sans-serif",fontSize:10,marginTop:3}}>⚔️+{bon.atkBonus} 🛡️+{bon.blockBonus}{bon.healBonus?` 💚+${bon.healBonus}`:""}</div>}
          </div>
        )}
        <button onClick={()=>setScreen("title")} style={{marginTop:12,padding:"14px 36px",fontSize:"clamp(13px,4vw,15px)",fontWeight:700,background:"#450a0a",border:"2px solid #dc2626",color:"#fca5a5",borderRadius:10,cursor:"pointer",minHeight:48,width:"100%",maxWidth:240}}>다시 도전</button>
      </div>
    );
  }

  // ─── WIN ───
  if(screen==="win") return (
    <div style={{minHeight:"100vh",background:"#030712",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Cinzel',serif",padding:"16px 14px",textAlign:"center"}}>
      <style>{GS}</style>
      <div style={{fontSize:"clamp(50px,15vw,70px)"}}>🏆</div>
      <h2 style={{fontSize:"clamp(24px,7vw,32px)",color:"#fbbf24",fontWeight:900,letterSpacing:"clamp(2px,1vw,4px)",margin:"8px 0",animation:"glow 2s infinite"}}>VICTORY!</h2>
      <p style={{color:"#d1fae5",fontFamily:"sans-serif",margin:"4px 0"}}>200층을 정복하고 왕국을 구했습니다! 🐉</p>
      {player&&<p style={{color:"#fbbf24",fontFamily:"sans-serif",fontSize:13,margin:"2px 0"}}>Lv.{player.level} {JOBS[player.jobId]?.name} · {player.gold}G</p>}
      <button onClick={()=>setScreen("title")} style={{marginTop:12,padding:"14px 36px",fontSize:"clamp(13px,4vw,15px)",fontWeight:700,background:"#451a03",border:"2px solid #d97706",color:"#fde68a",borderRadius:10,cursor:"pointer",minHeight:48,width:"100%",maxWidth:240}}>새 게임</button>
    </div>
  );

  // ─── MAP ───
  if(screen==="map"&&player){
    const j=JOBS[player.jobId];
    return (
      <div style={{minHeight:"100vh",background:"#030712",fontFamily:"'Cinzel',serif",padding:"12px 12px",backgroundImage:"radial-gradient(ellipse at 50% 0%,#0d0a20 0%,#030712 70%)"}}>
        <style>{GS}</style>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
            <div>
              <span style={{color:j.color,fontWeight:700,fontSize:"clamp(12px,3.5vw,14px)"}}>{j.emoji} Lv.{player.level} {j.name}</span>
              <span style={{color:"#4b5563",fontSize:9,marginLeft:5}}>XP {player.xp}/{xpForLevel(player.level)}</span>
            </div>
            <div style={{display:"flex",gap:8,fontSize:11,color:"#94a3b8",alignItems:"center"}}>
              <span>💰{player.gold}G</span>
              <span>📖{player.deck.length}</span>
              <button onClick={()=>setShowDeck(!showDeck)} style={{fontSize:9,padding:"2px 6px",background:"#1e1b4b",border:"1px solid #3730a3",color:"#818cf8",borderRadius:4,cursor:"pointer"}}>덱</button>
            </div>
          </div>
          <HPBar cur={player.hp} max={player.maxHp} color="#3b82f6"/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#4b5563",marginTop:2,marginBottom:2}}>
            <span>❤️{player.hp}/{player.maxHp}</span><span>💎{player.maxMana} 패{player.handSize}</span>
          </div>
          <XPBar xp={player.xp} needed={xpForLevel(player.level)}/>
          <div style={{textAlign:"center",color:"#7c6fcd",fontSize:11,margin:"10px 0 14px",fontFamily:"'Crimson Text',serif",fontStyle:"italic"}}>— Floor {floor}/200 — 이동할 곳을 선택하세요 —</div>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {mapNodes.map(node=>{
              const ic={battle:"⚔️",boss:"👑",shop:"🛒",rest:"⛺",elite:"💀"}[node.type];
              const lb={battle:"일반 전투",boss:`보스 (Floor ${floor})`,shop:"상점",rest:"휴식 (+25HP)",elite:"정예 전투"}[node.type];
              const col={battle:"#ef4444",boss:"#f59e0b",shop:"#22c55e",rest:"#3b82f6",elite:"#a855f7"}[node.type];
              return (
                <button key={node.id} onClick={()=>!node.visited&&enterNode(node)} disabled={node.visited}
                  style={{padding:"14px 18px",borderRadius:10,cursor:node.visited?"default":"pointer",background:node.visited?"rgba(255,255,255,.02)":"rgba(15,10,35,.95)",
                    border:`2px solid ${node.visited?"#1e1b4b":col}`,display:"flex",alignItems:"center",gap:12,opacity:node.visited?.4:1,
                    boxShadow:node.visited?"none":`0 0 12px ${col}33`}}>
                  <span style={{fontSize:26}}>{ic}</span>
                  <div style={{textAlign:"left"}}>
                    <div style={{color:node.visited?"#374151":col,fontWeight:700,fontSize:12}}>{lb}</div>
                    <div style={{color:"#4b5563",fontSize:10,fontFamily:"sans-serif"}}>{node.visited?"완료":"클릭하여 진입"}</div>
                  </div>
                  {!node.visited&&<div style={{marginLeft:"auto",color:col,fontSize:14}}>→</div>}
                </button>
              );
            })}
          </div>
          {showDeck&&(
            <div style={{marginTop:16,background:"rgba(0,0,0,.4)",borderRadius:10,padding:"10px 8px"}}>
              <div style={{color:"#4b5563",fontSize:10,marginBottom:6}}>📖 덱 ({player.deck.length}장)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{player.deck.map((id,i)=><CardComp key={i} cardId={id} tiny/>)}</div>
            </div>
          )}
          <div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["❤️","HP",`${player.hp}/${player.maxHp}`],["💎","마나",player.maxMana],["🃏","패",player.handSize],["📖","덱",player.deck.length]].map(([e,n,v])=>(
              <div key={n} style={{flex:1,minWidth:56,background:"rgba(255,255,255,.03)",border:"1px solid #1e1b4b",borderRadius:7,padding:"7px 8px",textAlign:"center"}}>
                <div style={{fontSize:14}}>{e}</div>
                <div style={{fontSize:8,color:"#4b5563"}}>{n}</div>
                <div style={{fontSize:11,color:"#a5b4fc",fontWeight:700}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── SHOP ───
  if(screen==="shop"&&player) return (
    <div style={{minHeight:"100vh",background:"#030712",fontFamily:"'Cinzel',serif",padding:"14px 12px",backgroundImage:"radial-gradient(ellipse at 50% 30%,#0a1a0a 0%,#030712 70%)"}}>
      <style>{GS}</style>
      <div style={{maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h2 style={{margin:0,color:"#22c55e",fontSize:17}}>🛒 신비의 상점</h2>
          <span style={{color:"#fbbf24",fontSize:13}}>💰{player.gold}G</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {shopItems.map(item=>{
            const c=getCard(item.id); if(!c) return null;
            const canBuy=player.gold>=item.price&&!boughtItems.includes(item.id);
            const bought=boughtItems.includes(item.id);
            return (
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(10,20,10,.9)",border:`1px solid ${bought?"#1a3320":"#166534"}`,borderRadius:10,opacity:bought?.5:1}}>
                <CardComp cardId={item.id} tiny/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{color:"#bbf7d0",fontWeight:700,fontSize:12}}>{c.name}</span>
                    {c.elem&&<ElemBadge elem={c.elem} small/>}
                    <span style={{fontSize:8,color:RARITY_COLOR[c.rarity]}}>{c.rarity}</span>
                  </div>
                  <div style={{color:"#6b7280",fontSize:10,fontFamily:"sans-serif",marginTop:1}}>{c.desc}</div>
                </div>
                <button onClick={()=>buyCard(item)} disabled={!canBuy}
                  style={{padding:"7px 12px",borderRadius:7,cursor:canBuy?"pointer":"default",
                    background:bought?"#1a2a1a":canBuy?"#166534":"#0f1f0f",border:"1px solid #22c55e",
                    color:canBuy?"#86efac":"#374151",fontSize:11,fontWeight:700}}>
                  {bought?"완료":`${item.price}G`}
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={()=>{setBoughtItems([]);advanceFloor();}} style={{marginTop:18,width:"100%",padding:"12px",borderRadius:9,cursor:"pointer",background:"#1e1b4b",border:"2px solid #4338ca",color:"#a5b4fc",fontSize:13,fontWeight:700}}>🗺️ 다음으로</button>
      </div>
    </div>
  );

  // ─── BATTLE ───
  if(screen==="battle"&&battle&&player){
    const j=JOBS[player.jobId];
    const pFloats=floats.filter(f=>f.eidx<0);
    const eFloats=i=>floats.filter(f=>f.eidx===i);
    return (
      <div style={{minHeight:"100vh",background:"#030712",fontFamily:"'Cinzel',serif",
        backgroundImage:"radial-gradient(ellipse at 50% 20%,#1a0a0a 0%,#030712 70%)",
        display:"flex",flexDirection:"column",padding:"8px 10px",
        maxWidth:"100%",margin:"0 auto",WebkitOverflowScrolling:"touch",
        overflowX:"hidden",boxSizing:"border-box",position:"relative"}}>
        <style>{GS}</style>
        {/* TOP BAR */}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#6b7280",marginBottom:5}}>
          <span style={{fontSize:"clamp(8px,2.5vw,10px)"}}>{j.emoji} Lv.{player.level} {j.name} · Floor {floor}/200 · 턴{battle.turn}</span>
          <span>💰{player.gold}G</span>
        </div>

        {/* ENEMIES */}
        <div style={{display:"flex",gap:6,marginBottom:6,marginTop:6}}>
          {battle.enemies.map((e,i)=>{
            const actIdx=(battle.actingEnemyIdx||0)%battle.enemies.length;
            return <EnemyCard key={e.id+i} enemy={e}
              isTarget={battle.targetIdx===i&&battle.enemies.length>1}
              isActing={i===actIdx}
              onClick={()=>!battle.ended&&setBattle(b=>({...b,targetIdx:i}))}
              floats={eFloats(i)}/>;
          })}
        </div>

        {/* PLAYER */}
        <div style={{background:"rgba(5,10,20,.9)",border:"1px solid #1e3a5f",borderRadius:11,padding:"8px 10px",marginBottom:6,position:"relative"}}>
          <FloatMsg messages={pFloats}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <span style={{fontSize:11,color:"#93c5fd",fontWeight:700}}>{j.emoji} {j.name}</span>
              <span style={{fontSize:9,color:"#9ca3af",marginLeft:5}}>HP {player.hp}/{player.maxHp}</span>
            </div>
            <div style={{display:"flex",gap:6,fontSize:11,alignItems:"center"}}>
              {battle.playerBlock>0&&<span style={{color:"#60a5fa"}}>🛡️{battle.playerBlock}</span>}
              <span style={{color:"#818cf8"}}>💎{battle.mana}/{battle.maxMana}</span>
            </div>
          </div>
          <HPBar cur={player.hp} max={player.maxHp} color="#3b82f6"/>
          <div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
            {Array.from({length:battle.maxMana}).map((_,i)=>(
              <div key={i} style={{width:11,height:11,borderRadius:"50%",background:i<battle.mana?"#6366f1":"#1e1b4b",border:"1.5px solid #4338ca",transition:"background .2s"}}/>
            ))}
            {/* 콤보 게이지 */}
            {Object.entries(battle.comboCount||{}).filter(([,v])=>v>0).map(([el,cnt])=>{
              const e=ELEMENTS[el];
              return <span key={el} style={{fontSize:9,color:e.color,background:e.color+"15",borderRadius:3,padding:"1px 5px",marginLeft:4}}>{e.emoji}×{cnt}/2</span>;
            })}
          </div>
        </div>

        {/* HAND — 가로 스크롤, 터치 친화적 */}
        <div style={{flex:1,marginBottom:6,minHeight:0}}>
          <div style={{color:"#4b5563",fontSize:9,marginBottom:3}}>
            🃏{battle.hand.length}장 · 덱:{battle.drawPile.length} · 버림:{battle.discardPile.length}
            {battle.enemies.length>1&&<span style={{color:"#fbbf24",marginLeft:5}}>▶ 적 탭으로 대상 변경</span>}
          </div>
          <div style={{display:"flex",gap:"clamp(4px,1.5vw,7px)",overflowX:"auto",paddingBottom:6,paddingTop:2,
            WebkitOverflowScrolling:"touch",scrollSnapType:"x mandatory",
            width:"100%",minWidth:0}}>
            {battle.hand.map((id,i)=>{
              const c=getCard(id); const canPlay=c&&c.cost<=battle.mana&&!battle.ended;
              return (
                <div key={i} style={{scrollSnapAlign:"start",flexShrink:0}}>
                  <CardComp cardId={id} playable={canPlay} onClick={()=>playCard(i)} dimmed={!canPlay&&!battle.ended}/>
                </div>
              );
            })}
            {battle.hand.length===0&&<div style={{color:"#374151",fontSize:11,fontFamily:"sans-serif",padding:"16px 6px"}}>패 없음</div>}
          </div>
        </div>

        {/* END TURN */}
        <button onClick={endTurn} disabled={battle.ended}
          style={{padding:"13px",borderRadius:10,cursor:battle.ended?"default":"pointer",
            background:battle.ended?"#1a1a2e":"linear-gradient(135deg,#7c3aed,#4338ca)",
            border:"none",color:"#e0d7ff",fontSize:"clamp(12px,3.5vw,14px)",fontWeight:700,
            letterSpacing:2,marginBottom:6,boxShadow:battle.ended?"none":"0 4px 18px #4c1d9566",
            minHeight:46}}>
          {battle.ended?"전투 종료...":"⚔️ 턴 종료"}
        </button>

        {/* LOG */}
        <div style={{background:"rgba(0,0,0,.35)",borderRadius:7,padding:"5px 8px",maxHeight:70,overflowY:"auto"}}>
          {log.map((l,i)=><div key={i} style={{fontSize:9,color:i===0?"#e2e8f0":"#374151",fontFamily:"sans-serif",marginBottom:1,lineHeight:1.4}}>{l}</div>)}
        </div>

        {/* 카드 선택 보상 */}
        {showReward&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.93)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:100,padding:"16px 12px",overflowY:"auto"}}>
            <h3 style={{color:"#fbbf24",fontFamily:"'Cinzel',serif",marginBottom:4,fontSize:"clamp(14px,4vw,17px)"}}>🏆 카드 보상 선택!</h3>
            <p style={{color:"#6b7280",fontFamily:"sans-serif",fontSize:11,marginBottom:14}}>1장을 덱에 추가</p>
            <div style={{display:"flex",gap:"clamp(8px,3vw,14px)",flexWrap:"wrap",justifyContent:"center"}}>
              {rewardCards.map(id=><div key={id} onClick={()=>pickReward(id)} style={{cursor:"pointer"}}><CardComp cardId={id} playable/></div>)}
            </div>
            <button onClick={()=>pickReward(null)} style={{marginTop:16,padding:"10px 24px",background:"#1e1b4b",border:"1px solid #4338ca",color:"#94a3b8",borderRadius:7,cursor:"pointer",fontSize:12,minHeight:42}}>건너뛰기</button>
          </div>
        )}
      </div>
    );
  }
  return null;
}