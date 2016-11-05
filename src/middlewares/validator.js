import Joi from 'joi';
import { Dependencies } from 'constitute';
import wrapper from '../utils/wrapper';
import { FormInvalidateException } from '../exceptions';

const validate = (data, schema) =>
  new Promise((resolve, reject) => {
    Joi.validate(data, schema, (err, value) => {
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    });
  });

/**
 * @returns {function()}
 * @constructor
 */
function ValidatorMiddleware(validator) {
  return getSchema => wrapper(async(req, res, next) => { //eslint-disable-line no-unused-vars
    const { query, body } = getSchema(validator || Joi);
    try {
      if (query) {
        await validate(req.query, query);
      }
      if (body) {
        await validate(req.body, body);
      }
    } catch (e) {
      throw new FormInvalidateException(e);
    }
  });
}
Dependencies()(ValidatorMiddleware);  //eslint-disable-line new-cap

export default ValidatorMiddleware;
