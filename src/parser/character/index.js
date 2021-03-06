import DICTIONARY from "../dictionary.js";
import utils from "../../utils.js";

let getProficiencies = (data) => {
  let sections = [];
  for (let section in data.character.modifiers) {
    sections.push(data.character.modifiers[section]);
  }

  let proficiencies = [];
  sections.forEach((section) => {
    let entries = section.filter((entry) => entry.type === "proficiency");
    proficiencies = proficiencies.concat(entries);
  });

  proficiencies = proficiencies.map((proficiency) => {
    return { name: proficiency.friendlySubtypeName };
  });

  return proficiencies;
};

let get5EBuiltIn = (data) => {
  let results = {
    powerfulBuild: false,
    savageAttacks: false,
    elvenAccuracy: false,
    halflingLucky: false,
    initiativeAdv: false,
    initiativeAlert: false,
    jackOfAllTrades: false,
    weaponCriticalThreshold: 20,
    observantFeat: false,
    remarkableAthlete: false,
    reliableTalent: false,
  };

  // powerful build/equine build
  results.powerfulBuild =
    data.character.race.racialTraits.filter(
      (trait) => trait.definition.name === "Equine Build" || trait.definition.name === "Powerful Build"
    ).length > 0;

  // savage attacks
  results.savageAttacks =
    data.character.race.racialTraits.filter((trait) => trait.definition.name === "Savage Attacks").length > 0;

  // halfling lucky
  results.halflingLucky =
    data.character.race.racialTraits.filter((trait) => trait.definition.name === "Lucky").length > 0;

  // elven accuracy
  results.elvenAccuracy = data.character.feats.filter((feat) => feat.definition.name === "Elven Accuracy").length > 0;

  // alert feat
  results.initiativeAlert = data.character.feats.filter((feat) => feat.definition.name === "Alert").length > 0;

  // advantage on initiative
  results.initiativeAdv = utils.filterBaseModifiers(data, "advantage", "initiative").length > 0;

  // initiative half prof
  results.initiativeHalfProf = utils.filterBaseModifiers(data, "half-proficiency", "initiative").length > 0;

  // observant
  results.observantFeat = data.character.feats.filter((feat) => feat.definition.name === "Observant").length > 0;

  // weapon critical threshold
  // fighter improved crit
  // remarkable athlete
  data.character.classes.forEach((cls) => {
    if (cls.subclassDefinition) {
      // Improved Critical
      const improvedCritical =
        cls.subclassDefinition.classFeatures.filter(
          (feature) => feature.name === "Improved Critical" && cls.level >= feature.requiredLevel
        ).length > 0;
      const superiorCritical =
        cls.subclassDefinition.classFeatures.filter(
          (feature) => feature.name === "Superior Critical" && cls.level >= feature.requiredLevel
        ).length > 0;

      if (superiorCritical) {
        results.weaponCriticalThreshold = 18;
      } else if (improvedCritical) {
        results.weaponCriticalThreshold = 19;
      }

      // Remarkable Athlete
      results.remarkableAthlete =
        cls.subclassDefinition.classFeatures.filter(
          (feature) => feature.name === "Remarkable Athlete" && cls.level >= feature.requiredLevel
        ).length > 0;
    }

    //Jack of All Trades
    results.jackOfAllTrades =
      cls.definition.classFeatures.filter(
        (feature) => feature.name === "Jack of All Trades" && cls.level >= feature.requiredLevel
      ).length > 0;

    //Reliable Talent
    results.reliableTalent =
      cls.definition.classFeatures.filter(
        (feature) => feature.name === "Reliable Talent" && cls.level >= feature.requiredLevel
      ).length > 0;
  });

  return results;
};

let getLevel = (data) => {
  return data.character.classes.reduce((prev, cur) => prev + cur.level, 0);
};

/**
 * Retrieves character abilities, including proficiency on saving throws
 * @param {obj} data JSON Import
 * @param {obj} character Character template
 */
let getAbilities = (data, character) => {
  // go through every ability

  let result = {};
  DICTIONARY.character.abilities.forEach((ability) => {
    result[ability.value] = {
      value: 0,
      min: 3,
      proficient: 0,
    };

    const stat = data.character.stats.find((stat) => stat.id === ability.id).value || 0;
    const bonusStat = data.character.bonusStats.find((stat) => stat.id === ability.id).value || 0;
    const overrideStat = data.character.overrideStats.find((stat) => stat.id === ability.id).value || 0;
    const abilityScoreMaxBonus = utils
      .filterBaseModifiers(data, "bonus", "ability-score-maximum")
      .filter((mod) => mod.statId === ability.id)
      .reduce((prev, cur) => prev + cur.value, 0);
    const bonus = utils
      .filterBaseModifiers(data, "bonus", `${ability.long}-score`)
      .filter((mod) => mod.entityId === ability.id)
      .reduce((prev, cur) => prev + cur.value, 0);
    const setAbilities = utils
      .filterBaseModifiers(data, "set", `${ability.long}-score`, [null, "", "if not already higher"])
      .map((mod) => mod.value);
    const setAbility = Math.max(...[0, ...setAbilities]);
    const calculatedStat = overrideStat === 0 ? stat + bonusStat + bonus + abilityScoreMaxBonus : overrideStat;

    // calculate value, mod and proficiency
    result[ability.value].value = calculatedStat > setAbility ? calculatedStat : setAbility;
    result[ability.value].mod = utils.calculateModifier(result[ability.value].value);
    result[ability.value].proficient =
      data.character.modifiers.class.find(
        (mod) => mod.subType === ability.long + "-saving-throws" && mod.type === "proficiency"
      ) !== undefined
        ? 1
        : 0;
  });

  return result;
};

let getHitDice = (data, character) => {
  let used = data.character.classes.reduce((prev, cls) => prev + cls.hitDiceUsed, 0);
  let total = data.character.classes.reduce((prev, cls) => prev + cls.level, 0);
  return total - used;
};

let getDeathSaves = (data, character) => {
  return {
    success: data.character.deathSaves.successCount || 0,
    failure: data.character.deathSaves.failCount || 0,
  };
};

let getExhaustion = (data, character) => {
  let condition = data.character.conditions.find((condition) => (condition.id = 4));
  let level = condition ? condition.level : 0;
  return level;
};

let isArmored = (data) => {
  return data.character.inventory.filter((item) => item.equipped && item.definition.armorClass).length >= 1;
};

let getMinimumBaseAC = (modifiers) => {
  let hasBaseArmor = modifiers.filter(
    (modifier) => modifier.type === "set" && modifier.subType === "minimum-base-armor" && modifier.isGranted
  );
  let baseAC = [];
  hasBaseArmor.forEach((base) => {
    baseAC.push(base.value);
  });
  return baseAC;
};

let getBaseArmor = (ac, armorType) => {
  return {
    definition: {
      name: "Base Armor - Racial",
      type: armorType,
      armorClass: ac,
      armorTypeId: DICTIONARY.equipment.armorTypeID.find((id) => id.name === armorType).id,
      grantedModifiers: [],
      canAttune: false,
      filterType: "Armor",
    },
    isAttuned: false,
  };
};

let getEquippedAC = (equippedGear) => {
  return equippedGear.reduce((prev, item) => {
    let ac = 0;
    // regular armor
    if (item.definition.armorClass) {
      ac += item.definition.armorClass;
    }

    // magical armor
    if (item.definition.grantedModifiers) {
      let isAvailable = false;
      // does an item need attuning
      if (item.definition.canAttune === true) {
        if (item.isAttuned === true) {
          isAvailable = true;
        }
      } else {
        isAvailable = true;
      }

      if (isAvailable) {
        item.definition.grantedModifiers.forEach((modifier) => {
          if (modifier.type === "bonus" && modifier.subType === "armor-class") {
            // add this to armor AC
            ac += modifier.value;
          }
        });
      }
    }
    return prev + ac;
  }, 0);
};

// returns an array of ac values from provided array of modifiers
let getUnarmoredAC = (modifiers, character) => {
  let unarmoredACValues = [];
  const isUnarmored = modifiers.filter(
    (modifier) => modifier.type === "set" && modifier.subType === "unarmored-armor-class" && modifier.isGranted
  );

  isUnarmored.forEach((unarmored) => {
    let unarmoredACValue = 10;
    // +DEX
    unarmoredACValue += character.data.abilities.dex.mod;
    // +WIS or +CON, if monk or barbarian, draconic resilience === null

    if (unarmored.statId !== null) {
      let ability = DICTIONARY.character.abilities.find((ability) => ability.id === unarmored.statId);
      unarmoredACValue += character.data.abilities[ability.value].mod;
    } else {
      // others are picked up here e.g. Draconic Resilience
      unarmoredACValue += unarmored.value;
    }
    unarmoredACValues.push(unarmoredACValue);
  });
  return unarmoredACValues;
};

// returns an array of ac values from provided array of modifiers
let getArmoredACBonuses = (modifiers, character) => {
  let armoredACBonuses = [];
  const armoredBonuses = modifiers.filter(
    (modifier) => modifier.subType === "armored-armor-class" && modifier.isGranted
  );

  armoredBonuses.forEach((armoredBonus) => {
    let armoredACBonus = 0;
    if (armoredBonus.statId !== null) {
      let ability = DICTIONARY.character.abilities.find((ability) => ability.id === armoredBonus.statId);
      armoredACBonus += character.data.abilities[ability.value].mod;
    } else {
      armoredACBonus += armoredBonus.value;
    }
    armoredACBonuses.push(armoredACBonus);
  });
  return armoredACBonuses;
};

let getArmorClass = (data, character) => {
  // array to assemble possible AC values
  let armorClassValues = [];
  // get a list of equipped armor
  // we make a distinction so we can loop over armor
  let equippedArmor = data.character.inventory.filter(
    (item) => item.equipped && item.definition.filterType === "Armor"
  );
  let baseAC = 10;
  // for things like fighters fighting style
  let miscACBonus = 0;
  // lets get equipped gear
  const equippedGear = data.character.inventory.filter(
    (item) => item.equipped && item.definition.filterType !== "Armor"
  );
  const unarmoredACBonus = utils
    .filterBaseModifiers(data, "bonus", "unarmored-armor-class")
    .reduce((prev, cur) => prev + cur.value, 0);

  // lets get the AC for all our non-armored gear, we'll add this later
  const gearAC = getEquippedAC(equippedGear);

  console.log("Calculated GearAC: " + gearAC);
  console.log("Unarmoured AC Bonus:" + unarmoredACBonus);

  // While not wearing armor, lets see if we have special abilities
  if (!isArmored(data)) {
    // unarmored abilities from Class/Race?
    const unarmoredSources = [data.character.modifiers.class, data.character.modifiers.race];
    unarmoredSources.forEach((modifiers) => {
      const unarmoredAC = Math.max(getUnarmoredAC(modifiers, character));
      if (unarmoredAC) {
        // we add this as an armored type so we can get magical item bonuses
        // e.g. ring of protection
        equippedArmor.push(getBaseArmor(unarmoredAC, "Unarmored Defense"));
      }
    });
  } else {
    // check for things like fighters fighting style defense
    const armorBonusSources = [data.character.modifiers.class, data.character.modifiers.race];
    armorBonusSources.forEach((modifiers) => {
      const armoredACBonuses = getArmoredACBonuses(modifiers, character);
      miscACBonus += armoredACBonuses.reduce((a, b) => a + b, 0);
    });
  }

  // Generic AC bonuses like Warforfed Integrated Protection
  // item modifiers are loaded by ac calcs
  const miscModifiers = [
    data.character.modifiers.class,
    data.character.modifiers.race,
    data.character.modifiers.background,
    data.character.modifiers.feat,
  ];

  utils.filterModifiers(miscModifiers, "bonus", "armor-class").forEach((bonus) => {
    miscACBonus += bonus.value;
  });

  console.log("Calculated MiscACBonus: " + miscACBonus);

  // Each racial armor appears to be slightly different!
  // We care about Tortles and Lizardfolk here as they can use shields, but their
  // modifier is set differently
  switch (data.character.race.fullName) {
    case "Lizardfolk":
      baseAC = Math.max(getUnarmoredAC(data.character.modifiers.race, character));
      equippedArmor.push(getBaseArmor(baseAC, "Natural Armor"));
      break;
    case "Tortle":
      baseAC = Math.max(getMinimumBaseAC(data.character.modifiers.race, character));
      equippedArmor.push(getBaseArmor(baseAC, "Natural Armor"));
      break;
    default:
      equippedArmor.push(getBaseArmor(baseAC, "Unarmored"));
  }

  const shields = equippedArmor.filter(
    (shield) => shield.definition.type === "Shield" || shield.definition.armorTypeId === 4
  );
  const armors = equippedArmor.filter(
    (shield) => shield.definition.type !== "Shield" || shield.definition.armorTypeId !== 4
  );

  console.log("Equipped AC Options: " + JSON.stringify(equippedArmor));

  // the presumption here is that you can only wear a shield and a single
  // additional 'armor' piece. in DDB it's possible to equip multiple armor
  // types and it works out the best AC for you
  // we also want to handle unarmored for monks etc.
  // we might have multiple shields "equipped" by accident, so work out
  // the best one
  for (var armor = 0; armor < armors.length; armor++) {
    let armorAC = null;
    if (shields.length === 0) {
      armorAC = getEquippedAC([armors[armor]]);
    } else {
      for (var shield = 0; shield < shields.length; shield++) {
        armorAC = getEquippedAC([armors[armor], shields[shield]]);
      }
    }

    // Determine final AC values based on AC Type
    // Light Armor: AC + DEX
    // Medium ARmor: AC + DEX (max 2)
    // Heavy Armor: AC only
    // Unarmored Defense: Dex mod already included in calculation

    switch (armors[armor].definition.type) {
      case "Natural Armor":
      case "Unarmored Defense":
        if (shields.length === 0) armorAC += unarmoredACBonus;
        armorClassValues.push({
          name: armors[armor].definition.name,
          value: armorAC + gearAC + miscACBonus,
        });
        break;
      case "Heavy Armor":
        armorClassValues.push({
          name: armors[armor].definition.name,
          value: armorAC + gearAC + miscACBonus,
        });
        break;
      case "Medium Armor":
        armorClassValues.push({
          name: armors[armor].definition.name,
          value: armorAC + Math.min(2, character.data.abilities.dex.mod) + gearAC + miscACBonus,
        });
        break;
      case "Light Armor":
        armorClassValues.push({
          name: armors[armor].definition.name,
          value: armorAC + character.data.abilities.dex.mod + gearAC + miscACBonus,
        });
        break;
      default:
        armorClassValues.push({
          name: armors[armor].definition.name,
          value: armorAC + character.data.abilities.dex.mod + gearAC + miscACBonus,
        });
        break;
    }
  }

  // get the max AC we can use from our various computed values
  const max = Math.max.apply(
    Math,
    armorClassValues.map(function (type) {
      return type.value;
    })
  );

  return {
    type: "Number",
    label: "Armor Class",
    value: max,
  };
};

let getHitpoints = (data, character) => {
  const constitutionHP = character.data.abilities.con.mod * character.flags.vtta.dndbeyond.totalLevels;
  let baseHitPoints = data.character.baseHitPoints || 0;
  const bonusHitPoints = data.character.bonusHitPoints || 0;
  const overrideHitPoints = data.character.overrideHitPoints || 0;
  const removedHitPoints = data.character.removedHitPoints || 0;
  const temporaryHitPoints = data.character.temporaryHitPoints || 0;

  // get all hit points features
  const bonusHitpointsFeatures = utils.filterBaseModifiers(data, "bonus", "hit-points-per-level");

  // get their values
  const bonusHitpointsValues = bonusHitpointsFeatures.map((bonus) => {
    if (bonus.id.startsWith("class")) {
      const cls = utils.findClassByFeatureId(data, bonus.componentId);
      return cls.level * bonus.value;
    } else {
      return character.flags.vtta.dndbeyond.totalLevels * bonus.value;
    }
  });

  // sum up the bonus HP per class level
  const totalBonusHitpoints = bonusHitpointsValues.reduce((prev, cur) => prev + cur, 0);

  // add the result to the base hitpoints
  baseHitPoints += totalBonusHitpoints;

  return {
    value:
      overrideHitPoints === 0
        ? constitutionHP + baseHitPoints + bonusHitPoints - removedHitPoints
        : overrideHitPoints - removedHitPoints,
    min: 0,
    max: constitutionHP + baseHitPoints + bonusHitPoints,
    temp: temporaryHitPoints,
    tempmax: temporaryHitPoints,
  };
};

let getInitiative = (data, character) => {
  const initiativeBonus = getGlobalBonus(
    utils.filterBaseModifiers(data, "bonus", "initiative"),
    character,
    "initiative"
  );

  // If we have the alert Feat set, lets sub 5 so it's correct
  const initiative = character.flags.dnd5e.initiativeAlert
    ? {
        value: initiativeBonus - 5,
        bonus: 5, //used by FVTT internally
        mod: character.data.abilities.dex.mod,
      }
    : {
        value: initiativeBonus,
        bonus: 0, //used by FVTT internally
        mod: character.data.abilities.dex.mod,
      };

  return initiative;
};

let getSpeed = (data, character) => {
  // For all processing, we take into account the regular movement types of this character
  let movementTypes = {};
  for (let type in data.character.race.weightSpeeds.normal) {
    if (data.character.race.weightSpeeds.normal[type] !== 0) {
      movementTypes[type] = data.character.race.weightSpeeds.normal[type];
    }
  }

  // get bonus speed mods
  let restriction = ["", null];
  // Check for equipped Heavy Armor
  const wearingHeavy = data.character.inventory.some((item) => item.equipped && item.definition.type === "Heavy Armor");
  // Accounts for Barbarian Class Feature - Fast Movement
  if (!wearingHeavy) restriction.push("while you aren’t wearing heavy armor");

  const bonusSpeed = utils
    .filterBaseModifiers(data, "bonus", "speed", restriction)
    .reduce((speed, feat) => speed + feat.value, 0);

  //loop over speed types and add and racial bonuses and feat modifiers
  for (let type in movementTypes) {
    // is there a 'inntate-speed-[type]ing' race/class modifier?
    let innateSpeeds = data.character.modifiers.race.filter(
      (modifier) => modifier.type === "set" && modifier.subType === `innate-speed-${type}ing`
    );
    let base = movementTypes[type];

    innateSpeeds.forEach((speed) => {
      // take the highest value
      if (speed.value > base) {
        base = speed.value;
      }
    });
    // overwrite the (perhaps) changed value
    movementTypes[type] = base + bonusSpeed;
  }

  // unarmored movement for barbarians and monks
  if (!isArmored(data)) {
    data.character.modifiers.class
      .filter((modifier) => modifier.type === "bonus" && modifier.subType === "unarmored-movement")
      .forEach((bonusSpeed) => {
        for (let type in movementTypes) {
          movementTypes[type] += bonusSpeed.value;
        }
      });
  }

  // is there a custom seed over-ride?
  if (data.character.customSpeeds) {
    data.character.customSpeeds.forEach((speed) => {
      const type = DICTIONARY.character.speeds.find((s) => s.id === speed.movementId).type;
      movementTypes[type] = speed.distance;
    });
  }

  let special = "";
  for (let type in movementTypes) {
    if (type !== "walk") {
      special += utils.capitalize(type) + " " + movementTypes[type] + " ft, ";
    }
  }
  special = special.substr(0, special.length - 2);

  return {
    value: movementTypes.walk + " ft",
    special: special,
  };
};

// is there a spell casting ability?
let hasSpellCastingAbility = (spellCastingAbilityId) => {
  return DICTIONARY.character.abilities.find((ability) => ability.id === spellCastingAbilityId) !== undefined;
};

// convert spellcasting ability id to string used by vtta
let convertSpellCastingAbilityId = (spellCastingAbilityId) => {
  return DICTIONARY.character.abilities.find((ability) => ability.id === spellCastingAbilityId).value;
};

let getSpellCasting = (data, character) => {
  let result = [];
  data.character.classSpells.forEach((playerClass) => {
    let classInfo = data.character.classes.find((cls) => cls.id === playerClass.characterClassId);
    let spellCastingAbility = undefined;
    if (hasSpellCastingAbility(classInfo.definition.spellCastingAbilityId)) {
      // check to see if class has a spell casting ability
      spellCastingAbility = convertSpellCastingAbilityId(classInfo.definition.spellCastingAbilityId);
    } else if (
      classInfo.subclassDefinition &&
      hasSpellCastingAbility(classInfo.subclassDefinition.spellCastingAbilityId)
    ) {
      //some subclasses attach a spellcasting ability, e.g. Arcane Trickster
      spellCastingAbility = convertSpellCastingAbilityId(classInfo.subclassDefinition.spellCastingAbilityId);
    }
    if (spellCastingAbility !== undefined) {
      let abilityModifier = utils.calculateModifier(character.data.abilities[spellCastingAbility].value);
      result.push({ label: spellCastingAbility, value: abilityModifier });
    }
  });
  // we need to decide on one spellcasting ability, so we take the one with the highest modifier
  if (result.length === 0) {
    return "";
  } else {
    return result
      .sort((a, b) => {
        if (a.value > b.value) return -1;
        if (a.value < b.value) return 1;
        return 0;
      })
      .map((entry) => entry.label)[0];
  }
};

let getSpellDC = (data, character) => {
  if (character.data.attributes.spellcasting === "") {
    return 10;
  } else {
    return 8 + character.data.abilities[character.data.attributes.spellcasting].mod + character.data.attributes.prof;
  }
};

let getResources = (data) => {
  // get all resources
  let resources = [data.character.actions.race, data.character.actions.class, data.character.actions.feat]
    .flat()
    //let resources = data.character.actions.class
    .filter((action) => action.limitedUse && action.limitedUse.maxUses)
    .map((action) => {
      return {
        label: action.name,
        value: action.limitedUse.maxUses - action.limitedUse.numberUsed,
        max: action.limitedUse.maxUses,
        sr: action.limitedUse.resetType === 1,
        lr: action.limitedUse.resetType === 1 || action.limitedUse.resetType === 2,
      };
    })
    // sort by maxUses, I guess one wants to track the most uses first, because it's used more often
    .sort((a, b) => {
      if (a.max > b.max) return -1;
      if (a.max < b.max) return 1;
      return 0;
    })
    // get only the first three
    .slice(0, 3);

  let result = {
    primary: resources.length >= 1 ? resources[0] : { value: 0, max: 0, sr: false, lr: false, label: "" },
    secondary: resources.length >= 2 ? resources[1] : { value: 0, max: 0, sr: false, lr: false, label: "" },
    tertiary: resources.length >= 3 ? resources[2] : { value: 0, max: 0, sr: false, lr: false, label: "" },
  };
  return result;
};

let getBackground = (data) => {
  if (data.character.background.hasCustomBackground === false) {
    if (data.character.background.definition !== null) {
      return data.character.background.definition.name || "";
    } else {
      return "";
    }
  } else {
    return data.character.background.customBackground.name || "";
  }
};

let getTrait = (data) => {
  let result = data.character.traits.personalityTraits;
  if (result !== null) {
    result = result
      .split("\n")
      .map((e) => "<p>" + e + "</p>")
      .reduce((prev, cur) => prev + cur);
    result = result.replace("<p></p>", "");
  } else {
    result = "";
  }
  return result;
};

let getIdeal = (data) => {
  let result = data.character.traits.ideals;
  if (result !== null) {
    result = result
      .split("\n")
      .map((e) => "<p>" + e + "</p>")
      .reduce((prev, cur) => prev + cur);
    result = result.replace("<p></p>", "");
  } else {
    result = "";
  }
  return result;
};

let getBond = (data) => {
  let result = data.character.traits.bonds;
  if (result !== null) {
    result = result
      .split("\n")
      .map((e) => "<p>" + e + "</p>")
      .reduce((prev, cur) => prev + cur);
    result = result.replace("<p></p>", "");
  } else {
    result = "";
  }
  return result;
};

let getFlaw = (data) => {
  let result = data.character.traits.flaws;
  if (result !== null) {
    result = result
      .split("\n")
      .map((e) => "<p>" + e + "</p>")
      .reduce((prev, cur) => prev + cur);
    result = result.replace("<p></p>", "");
  } else {
    result = "";
  }
  return result;
};

/**
 * Gets the character's alignment
 * Defaults to Neutral, if not set in DDB
 * @todo: returns .name right now, should switch to .value once the DND5E options are fully implemented
 */
let getAlignment = (data) => {
  let alignmentID = data.character.alignmentId || 5;
  let alignment = DICTIONARY.character.alignments.find((alignment) => alignment.id === alignmentID); // DDBUtils.alignmentIdtoAlignment(alignmentID);
  return alignment.name;
};

let getBiography = (data) => {
  let format = (heading, text) => {
    text = text
      .split("\n")
      .map((text) => `<p>${text}</p>`)
      .join("");
    return `<h2>${heading}</h2>${text}`;
  };

  let personalityTraits = data.character.traits.personalityTraits
    ? format("Personality Traits", data.character.traits.personalityTraits)
    : "";
  let ideals = data.character.traits.ideals ? format("Ideals", data.character.traits.ideals) : "";
  let bonds = data.character.traits.bonds ? format("Bonds", data.character.traits.bonds) : "";
  let flaws = data.character.traits.flaws ? format("Flaws", data.character.traits.flaws) : "";

  let traits =
    personalityTraits !== "" || ideals !== "" || bonds !== "" || flaws !== ""
      ? "<h1>Traits</h1>" + personalityTraits + ideals + bonds + flaws
      : "";

  let backstory =
    data.character.notes.backstory !== null ? "<h2>Backstory</h2><p>" + data.character.notes.backstory + "</p>" : "";

  if (data.character.background.hasCustomBackground === true) {
    let bg = data.character.background.customBackground;

    let result = bg.name ? "<h1>" + bg.name + "</h1>" : "";
    result += bg.description ? "<p>" + bg.description + "</p>" : "";
    if (bg.featuresBackground) {
      result += "<h2>" + bg.featuresBackground.name + "</h2>";
      result += bg.featuresBackground.shortDescription.replace("\r\n", "");
      result += "<h3>" + bg.featuresBackground.featureName + "</h3>";
      result += bg.featuresBackground.featureDescription.replace("\r\n", "");
    }
    if (
      bg.characteristicsBackground &&
      bg.featuresBackground &&
      bg.featuresBackground.entityTypeId != bg.characteristicsBackground.entityTypeId
    ) {
      result += "<h2>" + bg.characteristicsBackground.name + "</h2>";
      result += bg.characteristicsBackground.shortDescription.replace("\r\n", "");
      result += "<h3>" + bg.characteristicsBackground.featureName + "</h3>";
      result += bg.characteristicsBackground.featureDescription.replace("\r\n", "");
    }

    return {
      public: result + backstory + traits,
      value: result + backstory + traits,
    };
  } else {
    if (data.character.background.definition !== null) {
      let bg = data.character.background.definition;

      let result = "<h1>" + bg.name + "</h1>";
      result += bg.shortDescription.replace("\r\n", "");
      if (bg.featureName) {
        result += "<h2>" + bg.featureName + "</h2>";
        result += bg.featureDescription.replace("\r\n", "");
      }
      return {
        public: result + backstory + traits,
        value: result + backstory + traits,
      };
    } else {
      return {
        public: "" + backstory + traits,
        value: "" + backstory + traits,
      };
    }
  }
};

let getSkills = (data, character) => {
  let result = {};
  DICTIONARY.character.skills.forEach((skill) => {
    let modifiers = [
      data.character.modifiers.class,
      data.character.modifiers.race,
      utils.getActiveItemModifiers(data),
      data.character.modifiers.feat,
      data.character.modifiers.background,
    ]
      .flat()
      .filter((modifier) => modifier.friendlySubtypeName === skill.label)
      .map((mod) => mod.type);

    const longAbility = DICTIONARY.character.abilities
      .filter((ability) => skill.ability === ability.value)
      .map((ability) => ability.long)[0];

    // e.g. champion for specific ability checks
    const halfProficiencyRoundedUp =
      data.character.modifiers.class.find(
        (modifier) =>
          modifier.type === "half-proficiency-round-up" && modifier.subType === `${longAbility}-ability-checks`
      ) !== undefined
        ? true
        : false;

    // Jack of All trades/half-rounded down
    const halfProficiency =
      data.character.modifiers.class.find(
        (modifier) =>
          (modifier.type === "half-proficiency" && modifier.subType === "ability-checks") || halfProficiencyRoundedUp
      ) !== undefined
        ? 0.5
        : 0;

    const proficient = modifiers.includes("expertise") ? 2 : modifiers.includes("proficiency") ? 1 : halfProficiency;

    const proficiencyBonus = halfProficiencyRoundedUp
      ? Math.ceil(2 * character.data.attributes.prof * proficient)
      : Math.floor(2 * character.data.attributes.prof * proficient);

    // Skill bonuses e.g. items
    const skillBonus = utils
      .filterBaseModifiers(data, "bonus", skill.label.toLowerCase())
      .map((skl) => skl.value)
      .reduce((a, b) => a + b, 0);

    const value = character.data.abilities[skill.ability].value + proficiencyBonus + skillBonus;

    result[skill.name] = {
      type: "Number",
      label: skill.label,
      ability: skill.ability,
      value: proficient,
      mod: utils.calculateModifier(value),
      bonus: skillBonus,
    };
  });

  return result;
};

/**
 * Checks the list of modifiers provided for a matching bonus type
 * and returns a sum of it's value. May include a dice string.
 * This only gets modifiers with out a restriction.
 * @param {*} modifiers
 * @param {*} character
 * @param {*} bonusSubType
 */
let getGlobalBonus = (modifiers, character, bonusSubType) => {
  const bonusMods = modifiers.flat().filter(
    (modifier) =>
      // isGranted could be used here, but doesn't seem to be consistently applied
      modifier.type === "bonus" &&
      (modifier.restriction === "" || modifier.restriction === null) &&
      modifier.subType === bonusSubType
  );

  let sum = 0;
  let diceString = "";
  bonusMods.forEach((bonus) => {
    if (bonus.statId !== null) {
      const ability = DICTIONARY.character.abilities.find((ability) => ability.id === bonus.statId);
      sum += character.data.abilities[ability.value].mod;
    } else if (bonus.dice) {
      const mod = bonus.dice.diceString;
      diceString += diceString === "" ? mod : " + " + mod;
    } else {
      sum += bonus.value;
    }
  });
  if (diceString !== "") {
    sum = sum + " + " + diceString;
  }

  return sum;
};

/**
 * Gets global bonuses to attacks and damage
 * Supply a list of maps that have the fvtt tyoe and ddb sub type, e,g,
 * { fvttType: "attack", ddbSubType: "magic" }
  {
    "attack": "",
    "damage": "",
  },
 * @param {*} lookupTable
 * @param {*} data
 * @param {*} character
 */
let getGlobalBonusAttackModifiers = (lookupTable, data, character) => {
  let result = {
    attack: "",
    damage: "",
  };
  const diceFormula = /\d*d\d*/;

  let lookupResults = {
    attack: {
      sum: 0,
      diceString: "",
    },
    damage: {
      sum: 0,
      diceString: "",
    },
  };

  lookupTable.forEach((b) => {
    const lookupResult = getGlobalBonus(
      utils.filterBaseModifiers(data, "bonus", b.ddbSubType),
      character,
      b.ddbSubType
    );
    const lookupMatch = diceFormula.test(lookupResult);

    // if a match then a dice string
    if (lookupMatch) {
      lookupResults[b.fvttType].diceString += lookupResult === "" ? lookupResult : " + " + lookupResult;
    } else {
      lookupResults[b.fvttType].sum += lookupResult;
    }
  });

  // loop through outputs from lookups and build a response
  ["attack", "damage"].forEach((fvttType) => {
    if (lookupResults[fvttType].diceString === "") {
      if (lookupResults[fvttType].sum !== 0) {
        result[fvttType] = lookupResults[fvttType].sum;
      }
    } else {
      result[fvttType] = lookupResults[fvttType].diceString;
      if (lookupResults[fvttType].sum !== 0) {
        result[fvttType] += " + " + lookupResults[fvttType].sum;
      }
    }
  });

  return result;
};

/**
 * Gets global bonuses to spell attacks and damage
 * Most likely from items such as wand of the warmage
 * supply type as 'ranged' or 'melee'
  {
    "attack": "",
    "damage": "",
  },
 * @param {*} data
 * @param {*} character
 * @param {*} type
 */
let getBonusSpellAttacks = (data, character, type) => {
  // I haven't found any matching global spell damage boosting mods in ddb
  const bonusLookups = [
    { fvttType: "attack", ddbSubType: "spell-attacks" },
    { fvttType: "attack", ddbSubType: `${type}-spell-attacks` },
  ];

  return getGlobalBonusAttackModifiers(bonusLookups, data, character);
};

/**
 * Gets global bonuses to weapon attacks and damage
 * Most likely from items such as wand of the warmage
 * supply type as 'ranged' or 'melee'
  {
    "attack": "",
    "damage": "",
  },
 * @param {*} data
 * @param {*} character
 * @param {*} type
 */
let getBonusWeaponAttacks = (data, character, type) => {
  // global melee damage is not a ddb type, in that it's likely to be
  // type specific. The only class one I know of is the Paladin Improved Smite
  // which will be handled in the weapon import later.
  const bonusLookups = [
    { fvttType: "attack", ddbSubType: `${type}-attacks` },
    { fvttType: "attack", ddbSubType: "weapon-attacks" },
    { fvttType: "attack", ddbSubType: `${type}-weapon-attacks` },
  ];

  return getGlobalBonusAttackModifiers(bonusLookups, data, character);
};

/**
 * Gets global bonuses to ability checks, saves and skills
 * These can come from Paladin auras or items etc
  "abilities": {
    "check": "",
    "save": "",
    "skill": ""
  },
 * @param {*} data
 * @param {*} character
 */
let getBonusAbilities = (data, character) => {
  let result = {};
  const bonusLookup = [
    { fvttType: "check", ddbSubType: "ability-checks" },
    { fvttType: "save", ddbSubType: "saving-throws" },
    // the foundry global ability check doesn't do skills (but should, probs)
    // we add in global ability check boosts here
    { fvttType: "skill", ddbSubType: "ability-checks" },
  ];

  bonusLookup.forEach((b) => {
    result[b.fvttType] = getGlobalBonus(
      utils.filterBaseModifiers(data, "bonus", b.ddbSubType),
      character,
      b.ddbSubType
    );
  });
  return result;
};

let getBonusSpellDC = (data, character) => {
  let result = {};
  const bonusLookup = [{ fvttType: "dc", ddbSubType: "spell-save-dc" }];

  bonusLookup.forEach((b) => {
    result[b.fvttType] = getGlobalBonus(
      utils.filterBaseModifiers(data, "bonus", b.ddbSubType),
      character,
      b.ddbSubType
    );
  });

  return result;
};

let getArmorProficiencies = (data, character) => {
  let values = [];
  let custom = [];

  // lookup the characters's proficiencies in the DICT
  let allProficiencies = DICTIONARY.character.proficiencies.filter((prof) => prof.type === "Armor");
  character.flags.vtta.dndbeyond.proficiencies.forEach((prof) => {
    if (prof.name === "Light Armor" && !values.includes("lgt")) {
      values.push("lgt");
    }
    if (prof.name === "Medium Armor" && !values.includes("med")) {
      values.push("med");
    }
    if (prof.name === "Heavy Armor" && !values.includes("hvy")) {
      values.push("hvy");
    }
    if (prof.name === "Shields" && !values.includes("shl")) {
      values.push("shl");
    }
    if (allProficiencies.find((p) => p.name === prof.name) !== undefined && !custom.includes(prof.name)) {
      custom.push(prof.name);
    }
  });

  return {
    value: [...new Set(values)],
    custom: [...new Set(custom)].join(";"),
  };
};
/*
DND5E.toolProficiencies = {
  "art": "Artisan's Tools",
  "disg": "Disguise Kit",
  "forg": "Forgery Kit",
  "game": "Gaming Set",
  "herb": "Herbalism Kit",
  "music": "Musical Instrument",
  "navg": "Navigator's Tools",
  "pois": "Poisoner's Kit",
  "thief": "Thieves' Tools",
  "vehicle": "Vehicle (Land or Water)"
};
*/
let getToolProficiencies = (data, character) => {
  let values = [];
  let custom = [];

  // lookup the characters's proficiencies in the DICT
  let allProficiencies = DICTIONARY.character.proficiencies.filter((prof) => prof.type === "Tool");
  character.flags.vtta.dndbeyond.proficiencies.forEach((prof) => {
    if (prof.name === "Artisan's Tools" && !values.includes("art")) {
      values.push("art");
    }
    if (prof.name === "Disguise Kit" && !values.includes("disg")) {
      values.push("disg");
    }
    if (prof.name === "Forgery Kit" && !values.includes("forg")) {
      values.push("forg");
    }
    if (prof.name === "Gaming Set" && !values.includes("game")) {
      values.push("game");
    }
    if (prof.name === "Musical Instrument" && !values.includes("music")) {
      values.push("music");
    }
    if (prof.name === "Thieves' Tools" && !values.includes("thief")) {
      values.push("thief");
    }
    if (prof.name === "Navigator's Tools" && !values.includes("navg")) {
      values.push("navg");
    }
    if (prof.name === "Poisoner's Kit" && !values.includes("pois")) {
      values.push("pois");
    }
    if (
      (prof.name === "Vehicle (Land or Water)" || prof.name === "Vehicle (Land)" || prof.name === "Vehicle (Water)") &&
      !values.includes("vehicle")
    ) {
      values.push("vehicle");
    }
    if (allProficiencies.find((p) => p.name === prof.name) !== undefined && !custom.includes(prof.name)) {
      custom.push(prof.name);
    }
  });

  data.character.customProficiencies.forEach((proficiency) => {
    if (proficiency.type === 2) {
      //type 2 is TOOL, 1 is SKILL, 3 is LANGUAGE
      custom.push(proficiency.name);
    }
  });

  return {
    value: [...new Set(values)],
    custom: [...new Set(custom)].join(";"),
  };
};

let getWeaponProficiencies = (data, character) => {
  let values = [];
  let custom = [];

  // lookup the characters's proficiencies in the DICT
  let allProficiencies = DICTIONARY.character.proficiencies.filter((prof) => prof.type === "Weapon");
  character.flags.vtta.dndbeyond.proficiencies.forEach((prof) => {
    if (prof.name === "Simple Weapons" && !values.includes("sim")) {
      values.push("sim");
    }
    if (prof.name === "Martial Weapons" && !values.includes("mar")) {
      values.push("mar");
    }
    if (allProficiencies.find((p) => p.name === prof.name) !== undefined && !custom.includes(prof.name)) {
      custom.push(prof.name);
    }
  });

  return {
    value: [...new Set(values)],
    custom: [...new Set(custom)].join("; "),
  };
};

let getSize = (data) => {
  let size = DICTIONARY.character.actorSizes.find((size) => size.name === data.character.race.size);
  return size ? size.value : "med";
};

let getSenses = (data) => {
  let senses = getSensesLookup(data);

  // sort the senses alphabetically
  senses = senses.sort((a, b) => a.name >= b.name);

  return senses.map((e) => e.name + ": " + e.value + " ft.").join(", ");
};

let getLanguages = (data) => {
  let languages = [];
  let custom = [];

  const modifiers = utils.filterBaseModifiers(data, "language");

  modifiers.forEach((language) => {
    let result = DICTIONARY.character.languages.find((lang) => lang.name === language.friendlySubtypeName);
    if (result) {
      languages.push(result.value);
    } else {
      custom.push(language.friendlySubtypeName);
    }
  });

  data.character.customProficiencies.forEach((proficiency) => {
    if (proficiency.type === 3) {
      //type 3 is LANGUAGE, 1 is SKILL, 2 is TOOL
      custom.push(proficiency.name);
    }
  });

  return {
    value: languages,
    custom: custom.map((entry) => utils.capitalize(entry)).join(", "),
  };
};

let getGenericConditionAffect = (data, condition, typeId) => {
  const damageTypes = DICTIONARY.character.damageTypes
    .filter((type) => type.kind === condition && type.type === typeId)
    .map((type) => type.value);

  let result = utils
    .filterBaseModifiers(data, condition)
    .filter((modifier) => modifier.isGranted && damageTypes.includes(modifier.subType))
    .map((modifier) => {
      const entry = DICTIONARY.character.damageTypes.find(
        (type) => type.type === typeId && type.kind === modifier.type && type.value === modifier.subType
      );
      return entry ? entry.vttaValue || entry.value : undefined;
    });

  result = result.concat(
    data.character.customDefenseAdjustments
      .filter((adjustment) => adjustment.type === typeId)
      .map((adjustment) => {
        const entry = DICTIONARY.character.damageTypes.find(
          (type) => type.id === adjustment.id && type.type === adjustment.type && type.kind === condition
        );
        return entry ? entry.vttaValue || entry.value : undefined;
      })
      .filter((adjustment) => adjustment !== undefined)
  );

  return result;
};

let getDamageImmunities = (data) => {
  return {
    custom: "",
    value: getGenericConditionAffect(data, "immunity", 2),
  };
};

let getDamageResistances = (data) => {
  return {
    custom: "",
    value: getGenericConditionAffect(data, "resistance", 2),
  };
};

let getDamageVulnerabilities = (data) => {
  return {
    custom: "",
    value: getGenericConditionAffect(data, "vulnerability", 2),
  };
};

let getConditionImmunities = (data) => {
  // get Condition Immunities
  return {
    custom: "",
    value: getGenericConditionAffect(data, "immunity", 1),
  };
};

let getCurrency = (data) => {
  return {
    pp: data.character.currencies.pp,
    gp: data.character.currencies.gp,
    ep: data.character.currencies.ep,
    sp: data.character.currencies.sp,
    cp: data.character.currencies.cp,
  };
};

let getSpellSlots = (data) => {
  let spellSlots = {};
  // get the caster information from all classes and subclasses
  let getCasterInfo = () => {
    return data.character.classes
      .filter((cls) => {
        return cls.definition.canCastSpells || (cls.subclassDefinition && cls.subclassDefinition.canCastSpells);
      })
      .map((cls) => {
        // the class total level
        let casterLevel = cls.level;
        // class name
        const name = cls.definition.name;

        // get the casting level if the character is a multiclassed spellcaster
        if (cls.definition.spellRules && cls.definition.spellRules.multiClassSpellSlotDivisor) {
          casterLevel = Math.floor(casterLevel / cls.definition.spellRules.multiClassSpellSlotDivisor);
        } else {
          casterLevel = 0;
        }

        const cantrips =
          cls.definition.spellRules &&
          cls.definition.spellRules.levelCantripsKnownMaxes &&
          Array.isArray(cls.definition.spellRules.levelCantripsKnownMaxes)
            ? cls.definition.spellRules.levelCantripsKnownMaxes[casterLevel + 1]
            : 0;

        if (["Warlock", "Blood Hunter"].includes(name)) {
          // pact casting doesn't count towards multiclass spells casting
          // we still add an entry to get cantrip info
          const levelSpellSlots = cls.definition.spellRules.levelSpellSlots[casterLevel];
          const maxLevel = levelSpellSlots.indexOf(Math.max(...levelSpellSlots)) + 1;
          const maxSlots = Math.max(...levelSpellSlots);
          const currentSlots = data.character.pactMagic.find((pact) => pact.level === maxLevel).used;
          spellSlots.pact = { value: maxSlots - currentSlots, max: maxSlots };
          return {
            name: name,
            casterLevel: 0,
            slots: cls.definition.spellRules.levelSpellSlots[0],
            cantrips: cantrips,
          };
        } else {
          return {
            name: name,
            casterLevel: casterLevel,
            slots: cls.definition.spellRules.levelSpellSlots[cls.level],
            cantrips: cantrips,
          };
        }
      });
  };

  let casterInfo = getCasterInfo(data);

  let result = null;
  if (casterInfo.length !== 1) {
    const multiClassSpellSlots = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0], // 0
      [2, 0, 0, 0, 0, 0, 0, 0, 0], // 1
      [3, 0, 0, 0, 0, 0, 0, 0, 0], // 2
      [4, 2, 0, 0, 0, 0, 0, 0, 0], // 3
      [4, 3, 0, 0, 0, 0, 0, 0, 0], // 4
      [4, 3, 2, 0, 0, 0, 0, 0, 0], // 5
      [4, 3, 3, 0, 0, 0, 0, 0, 0], // 6
      [4, 3, 3, 1, 0, 0, 0, 0, 0], // 7
      [4, 3, 3, 2, 0, 0, 0, 0, 0], // 8
      [4, 3, 3, 3, 1, 0, 0, 0, 0], // 9
      [4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
      [4, 3, 3, 3, 2, 1, 0, 0, 0], // 11
      [4, 3, 3, 3, 2, 1, 0, 0, 0], // 12
      [4, 3, 3, 3, 2, 1, 1, 0, 0], // 13
      [4, 3, 3, 3, 2, 1, 1, 0, 0], // 14
      [4, 3, 3, 3, 2, 1, 1, 1, 0], // 15
      [4, 3, 3, 3, 2, 1, 1, 1, 0], // 16
      [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
      [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
      [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
      [4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
    ];
    const casterLevelTotal = casterInfo.reduce((prev, cur) => prev + cur.casterLevel, 0);
    const cantripsTotal = casterInfo.reduce((prev, cur) => prev + cur.cantrips, 0);
    result = [cantripsTotal, ...multiClassSpellSlots[casterLevelTotal]];
  } else {
    result = [casterInfo[0].cantrips, ...casterInfo[0].slots];
  }

  for (let i = 0; i < result.length; i++) {
    const currentSlots = data.character.spellSlots.filter((slot) => slot.level === i).map((slot) => slot.used) || 0;
    spellSlots["spell" + i] = {
      value: result[i] - currentSlots,
      max: result[i],
    };
  }
  return spellSlots;
};

let getSensesLookup = (data) => {
  let senses = [];
  let hasDarkvision = false;
  // custom senses
  if (data.character.customSenses) {
    data.character.customSenses
      .filter((sense) => {
        !!sense.distance;
      })
      .forEach((sense) => {
        const s = DICTIONARY.character.senses.find((s) => s.id === sense.senseId);

        const senseName = s ? s.name : null;
        // remember that this darkvision has precedence
        if (senseName === "Darkvision") hasDarkvision = true;

        // remember this sense
        senses.push({ name: senseName, value: sense.distance });
      });
  }

  if (!hasDarkvision) {
    utils.filterBaseModifiers(data, "set-base", "darkvision").forEach((sense) => {
      senses.push({ name: sense.friendlySubtypeName, value: sense.value });
    });
  }

  // Magical bonuses
  utils
    .getActiveItemModifiers(data)
    .filter((mod) => mod.type === "sense")
    .map((mod) => {
      return {
        name: DICTIONARY.character.senses.find((s) => s.id === mod.entityId).name,
        value: mod.value,
      };
    })
    .forEach((mod) => {
      let sense = senses.find((sense) => sense.name === mod.name);
      if (sense) {
        sense.value += mod.value;
      } else {
        if (mod.name === "Darkvision") hasDarkvision = true;
        senses.push({ name: mod.name, value: mod.value });
      }
    });

  return senses;
};

let getToken = (data) => {
  /*
          obj.token = this.getToken(character);
          obj.token.img = results[1];
      */
  let tokenData = {
    actorData: {},
    actorLink: true,
    bar1: { attribute: "attributes.hp" },
    bar2: { attribute: "" },
    //brightLight: 0,
    brightSight: 0,
    //dimLight: 0,
    dimSight: 0,
    displayBars: 40,
    displayName: 40,
    disposition: -1,
    elevation: 0,
    flags: {},
    height: 1,
    //lightAngle: 360,
    lockRotation: false,
    name: data.character.name,
    randomImg: false,
    rotation: 0,
    //scale: 1,
    sightAngle: 360,
    vision: true,
    width: 1,
  };

  let senses = getSensesLookup(data);

  // Blindsight/Truesight
  if (senses.find((sense) => sense.name === "Truesight" || sense.name === "Blindsight") !== undefined) {
    let value = senses
      .filter((sense) => sense.name === "Truesight" || sense.name === "Blindsight")
      .reduce((prev, cur) => (prev > cur.value ? prev : cur.value), 0);
    tokenData.brightSight = value;
  }

  // Darkvision
  if (senses.find((sense) => sense.name === "Darkvision") !== undefined) {
    tokenData.dimSight = senses.find((sense) => sense.name === "Darkvision").value;
  }
  return tokenData;
};

export default function getCharacter(ddb) {
  /***************************************
   * PARSING THE CHARACTER
   ***************************************
   */

  let character = {
    data: JSON.parse(utils.getTemplate("character")),
    type: "character",
    name: ddb.character.name,
    // items: [],  // modified to check inventory analysis on update
    token: getToken(ddb),
    flags: {
      vtta: {
        dndbeyond: {
          totalLevels: getLevel(ddb),
          proficiencies: getProficiencies(ddb),
          roUrl: ddb.character.readonlyUrl,
        },
      },
    },
  };

  // Get supported 5e feats and abilities
  // We do this first so we can check for them later
  character.flags.dnd5e = get5EBuiltIn(ddb);

  // character abilities
  character.data.abilities = getAbilities(ddb, character);

  // Hit Dice
  character.data.attributes.hd = getHitDice(ddb, character);

  // Death saves
  character.data.attributes.death = getDeathSaves(ddb, character);

  // exhaustion
  character.data.attributes.exhaustion = getExhaustion(ddb, character);

  // inspiration
  character.data.attributes.inspiration = ddb.character.inspiration;

  // armor class
  character.data.attributes.ac = getArmorClass(ddb, character);

  // hitpoints
  character.data.attributes.hp = getHitpoints(ddb, character);

  // initiative
  character.data.attributes.init = getInitiative(ddb, character);

  // proficiency
  character.data.attributes.prof = Math.ceil(1 + 0.25 * character.flags.vtta.dndbeyond.totalLevels);

  // speeds
  character.data.attributes.speed = getSpeed(ddb, character);

  // spellcasting
  character.data.attributes.spellcasting = getSpellCasting(ddb, character);

  // spelldc
  character.data.attributes.spelldc = getSpellDC(ddb, character);

  // resources
  character.data.resources = getResources(ddb);

  // details
  character.data.details.background = getBackground(ddb);

  // xp
  character.data.details.xp.value = ddb.character.currentXp;

  // Character Traits/Ideal/Bond and Flaw
  character.data.details.trait = getTrait(ddb);
  character.data.details.ideal = getIdeal(ddb);
  character.data.details.bond = getBond(ddb);
  character.data.details.flaw = getFlaw(ddb);

  character.data.details.alignment = getAlignment(ddb);

  // bio
  character.data.details.biography = getBiography(ddb);
  character.data.details.race = ddb.character.race.fullName;

  // traits
  character.data.traits.weaponProf = getWeaponProficiencies(ddb, character);
  character.data.traits.armorProf = getArmorProficiencies(ddb, character);
  character.data.traits.toolProf = getToolProficiencies(ddb, character);
  character.data.traits.size = getSize(ddb);
  character.data.traits.senses = getSenses(ddb);
  character.data.traits.languages = getLanguages(ddb);
  character.data.traits.di = getDamageImmunities(ddb);
  character.data.traits.dr = getDamageResistances(ddb);
  character.data.traits.dv = getDamageVulnerabilities(ddb);
  character.data.traits.ci = getConditionImmunities(ddb);

  character.data.currency = getCurrency(ddb);
  character.data.skills = getSkills(ddb, character);
  character.data.spells = getSpellSlots(ddb);

  // Extra global bonuses
  // Extra bonuses
  character.data.bonuses.abilities = getBonusAbilities(ddb, character);
  // spell attacks
  character.data.bonuses.rsak = getBonusSpellAttacks(ddb, character, "ranged");
  character.data.bonuses.msak = getBonusSpellAttacks(ddb, character, "melee");
  // spell dc
  character.data.bonuses.spell = getBonusSpellDC(ddb, character);
  // melee weapon attacks
  character.data.bonuses.mwak = getBonusWeaponAttacks(ddb, character, "melee");
  // ranged weapon attacks
  // e.g. ranged fighting style
  character.data.bonuses.rwak = getBonusWeaponAttacks(ddb, character, "ranged");

  return character;
}
