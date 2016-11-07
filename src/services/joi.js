import Joi from 'joi';

export default class ValidatorBase {
  getJoi() {
    return Joi;
  }
}
