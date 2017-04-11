import Joi from 'joi';
import ServiceInterface from './interface';

export default class ValidatorBase extends ServiceInterface {

  getProto() {
    return Joi;
  }

  getJoi() {
    return Joi;
  }
}

