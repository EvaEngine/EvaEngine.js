import snakeCase from 'lodash/snakeCase.js';
import camelCase from 'lodash/camelCase.js';

/**
 * deeply converts keys of an object from one case to another
 * @param oldObject to convert
 * @param converterFunction function to convert key.
 * @return converted object
 */
const convertCase = (oldObject: unknown, converterFunction: (key: string) => string): unknown => {
  let newObject: unknown;

  if (!oldObject || typeof oldObject !== 'object' || !Object.keys(oldObject).length) {
    return oldObject;
  }

  if (Array.isArray(oldObject)) {
    newObject = oldObject.map(element => convertCase(element, converterFunction));
  } else {
    newObject = {};
    Object.keys(oldObject).forEach((oldKey) => {
      const newKey = converterFunction(oldKey);
      (newObject as Record<string, unknown>)[newKey] = convertCase((oldObject as Record<string, unknown>)[oldKey], converterFunction);
    });
  }

  return newObject;
};

export const toCamelCase = (obj: unknown): unknown => convertCase(obj, camelCase);
export const toSnakeCase = (obj: unknown): unknown => convertCase(obj, snakeCase);

export default { toCamelCase, toSnakeCase };
