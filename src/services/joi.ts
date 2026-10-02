import Joi from 'joi';
import ServiceInterface from './interface.ts';

export default class ValidatorBase extends ServiceInterface {
  override getProto(): typeof Joi {
    return Joi;
  }

  getJoi(): typeof Joi {
    return Joi;
  }
}
