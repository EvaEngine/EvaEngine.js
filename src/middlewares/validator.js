import Joi from 'joi';
import { Dependencies } from 'constitute';
import wrapper from '../utils/wrapper';
import { FormInvalidateException } from '../exceptions';
import ValidatorBase from '../services/joi';

const validate = (data, schema, options) =>
  new Promise((resolve, reject) => {
    Joi.validate(data, schema, Object.assign({ abortEarly: false }, options), (err, value) => {
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
function ValidatorMiddleware(validatorBase) {
  return (getSchema, options, validator) =>
    wrapper(async(req, res, next) => { //eslint-disable-line no-unused-vars
      const { query, body } = getSchema(validator || validatorBase.getJoi());
      try {
        if (query) {
          await validate(req.query, query, options);
        }
        if (body) {
          await validate(req.body, body, options);
        }
        return next();
      } catch (e) {
        throw new FormInvalidateException(e);
      }
    });
}
Dependencies(ValidatorBase)(ValidatorMiddleware);  //eslint-disable-line new-cap

export default ValidatorMiddleware;
