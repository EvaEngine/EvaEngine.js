import { Dependencies } from '../di.ts';
import Joi from 'joi';
import wrapper from '../utils/wrapper.ts';
import { FormInvalidateException } from '../exceptions/index.ts';
import ValidatorBase from '../services/joi.ts';
import type { Schema, AsyncValidationOptions } from 'joi';

type ValidatorSchemas = {
  query?: Schema;
  body?: Schema;
  path?: Schema;
};

const validate = (data: unknown, schema: Schema, options?: AsyncValidationOptions): Promise<unknown> => {
  const validationOptions = Object.assign(
    { abortEarly: false, allowUnknown: true },
    options
  );
  if (schema && typeof schema.validateAsync === 'function') {
    return schema.validateAsync(data, validationOptions);
  }
  //joi 18 已移除 legacy Joi.validate API，该分支仅在 schema 无 validateAsync 时可达，保留原调用形态
  return new Promise((resolve, reject) => {
    (Joi as unknown as {
      validate(data: unknown, schema: Schema, options: typeof validationOptions, callback: (err: Error | null, value: unknown) => void): void;
    }).validate(data, schema, validationOptions, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
};

function ValidatorMiddleware(validatorBase: ValidatorBase) {
  return (getSchema: (joi: typeof Joi) => ValidatorSchemas, options?: AsyncValidationOptions, validator?: typeof Joi) =>
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
        throw new FormInvalidateException(e as Error);
      }
    });
}

Dependencies(ValidatorBase)(ValidatorMiddleware);

export default ValidatorMiddleware;
