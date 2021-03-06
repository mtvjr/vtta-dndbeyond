import DICTIONARY from "../dictionary.js";
// type: weapon
import parseWeapon from "./weapon.js";
import parseAmmunition from "./ammunition.js";
import parseStaff from "./staves.js";

// type: armor
import parseArmor from "./armor.js";

// tyoe: wonderous item
import parseWonderous from "./wonderous.js";

// type: consumables
import parsePotion from "./potion.js";
import parseScroll from "./scroll.js";

// type: tool
import parseTool from "./tool.js";

// other loot
import parseLoot from "./loot.js";
import parseCustomItem from "./custom.js";
import utils from "../../utils.js";

// magicitems support
import parseMagicItem from "./magicify.js";

let parseItem = (ddb, data, character) => {
  // is it a weapon?
  if (data.definition.filterType) {
    switch (data.definition.filterType) {
      case "Weapon":
        let flags = {
          damage: {
            parts: [],
          },
          classFeatures: [],
        };
        // Some features, notably hexblade abilities we scrape out here
        flags.classFeatures = getWarlockFeatures(ddb, data.id);

        if (flags.classFeatures.includes("Lifedrinker")) {
          flags.damage.parts.push(["@mod", "necrotic"]);
        }

        if (data.definition.type === "Ammunition") {
          return parseAmmunition(data, character);
        } else {
          // for melee attacks get extras
          if (data.definition.attackType === 1) {
            // get improved divine smite etc for melee attacks
            const extraDamage = getExtraDamage(ddb, ["Melee Weapon Attacks"]);

            if (!!extraDamage.length > 0) {
              flags.damage.parts = flags.damage.parts.concat(extraDamage);
            }
            // do we have great weapon fighting?
            if (utils.hasChosenCharacterOption(ddb, "Great Weapon Fighting")) {
              flags.classFeatures.push("greatWeaponFighting");
            }
            // do we have dueling fighting style?
            if (utils.hasChosenCharacterOption(ddb, "Dueling")) {
              flags.classFeatures.push("Dueling");
            }
          }

          // ranged fighting style is added as a global modifier elsewhere
          // as is defensive style
          return parseWeapon(data, character, flags);
        }
        break;
      case "Armor":
        return parseArmor(data, character);
        break;
      case "Wondrous item":
      case "Ring":
      case "Wand":
      case "Rod":
        return parseWonderous(data, character);
        break;
      case "Staff":
        return parseStaff(data, character);
        break;
      case "Potion":
        return parsePotion(data, character);
        break;
      case "Scroll":
        return parseScroll(data, character);
        break;
      case "Other Gear":
        switch (data.definition.subType) {
          case 'Potion':
            return parsePotion(data, character);
            break;
          case 'Tool':
            return parseTool(data, character);
            break;
          default:
            return parseLoot(data, character);
        }
        break;
      default:
        return parseLoot(data, character);
        break;
    }
  } else {
    // try parsing it as a custom item
    return parseCustomItem(data, character);
  }
  utils.log(
    `Unknown item: ${data.definition.name}, ${data.definition.type}/${data.definition.filterType}`,
    "character"
  );
  return {};
};

/**
 * We get extra damage to a weapon attack here, for example Improved
 * Divine Smite
 * @param {*} data
 * @param {*} restrictions (array)
 */
let getExtraDamage = (ddb, restrictions) => {
  return utils
    .filterBaseModifiers(ddb, "damage", null, restrictions)
    .map((mod) => {
      if (mod.dice) {
        return [mod.dice.diceString, mod.subType];
      } else {
        if (mod.value) {
          return [mod.value, mod.subType];
        }
      }
    });
};

let getWarlockFeatures = (ddb, weaponId) => {
  // Some features, notably hexblade abilities we scrape out here
  const warlockFeatures = ddb.character.characterValues
    .filter(
      (charValue) =>
        charValue.value &&
        charValue.valueId === weaponId &&
        DICTIONARY.character.characterValuesLookup.find(
          (entry) =>
            entry.typeId === charValue.typeId &&
            entry.valueTypeId === charValue.valueTypeId
        )
    )
    .map(
      (charValue) =>
        DICTIONARY.character.characterValuesLookup.find(
          (entry) =>
            entry.typeId === charValue.typeId &&
            entry.valueTypeId === charValue.valueTypeId
        ).name
    );

  // Any Pact Weapon Features
  const pactFeatures = ddb.character.options.class
    .filter(
      (option) =>
        warlockFeatures.includes("pactWeapon") &&
        !!option.definition.name &&
        DICTIONARY.character.pactFeatures.includes(option.definition.name)
    )
    .map((option) => option.definition.name);

  return warlockFeatures.concat(pactFeatures);
};

export default function getInventory(ddb, character, itemSpells) {
  let items = [];
  // first, check custom name, price or weight
  ddb.character.characterValues.forEach((cv) => {
    // try to find a matching item based on the characterValues (an array of custom adjustements to different parts of the character)
    let item = ddb.character.inventory.find((item) => item.id === cv.valueId);
    if (item) {
      // check if this property is in the list of supported ones, based on our DICT
      let property = DICTIONARY.item.characterValues.find(
        (entry) => entry.typeId === cv.typeId
      );
      // overwrite the name, weight or price with the custom value
      if (property && cv.value.length !== 0)
        item.definition[property.value] = cv.value;
    }
  });

  // now parse all items

  const customItems = ddb.character.customItems
    ? ddb.character.customItems.map((customItem) => ({
        definition: customItem,
      }))
    : [];

  for (let entry of ddb.character.inventory.concat(customItems)) {
    var item = Object.assign({}, parseItem(ddb, entry, character));
    if (item) {
      item.flags.magicitems = parseMagicItem(
        entry,
        character,
        item,
        itemSpells
      );
      items.push(item);
    }
  }
  return items;
}
