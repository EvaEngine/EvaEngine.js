import Joi from 'joi';
import constitute from 'constitute';
import wrapper from '../utils/wrapper.js';
import { FormInvalidateException } from '../exceptions/index.js';
import ValidatorBase from '../services/joi.js';

const validate = (data, schema, options) => {
  const validationOptions = Object.assign(
    { abortEarly: false, allowUnknown: true },
    options
  );
  if (schema && typeof schema.validateAsync === 'function') {
    return schema.validateAsync(data, validationOptions);
  }
  return new Promise((resolve, reject) => {
    Joi.validate(data, schema, validationOptions, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
};

/**
 * @returns {function()}
 * @constructor
 */
function ValidatorMiddleware(validatorBase) {
  return (getSchema, options, validator) =>
    wrapper(async (req, res, next) => {
      const { query, body, path } = getSchema(validator || validatorBase.getJoi());
      try {
        if (query) {
          await validate(req.query, query, options);
        }
        if (body) {
          await validate(req.body, body, options);
        }
        if (path) {
          await validate(req.params, path, options);
        }
        return next();
      } catch (e) {
        throw new FormInvalidateException(e);
      }
    });
}

constitute.Dependencies(ValidatorBase)(ValidatorMiddleware);

export default ValidatorMiddleware;
