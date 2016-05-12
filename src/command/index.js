export default class Command {
  constructor(argv) {
    this.argv = argv;
    this.options = null;
  }

  getArgv() {
    return this.argv;
  }

  setArgv(argv) {
    this.argv = argv;
    return this;
  }

  setOptions(options) {
    this.options = options;
    return this;
  }

  getOptions() {
    const options = {};
    Object.keys(this.argv).forEach((key) => {
      if (key !== '$0' && ['string', 'number'].includes(typeof this.argv[key])) {
        options[key] = this.argv[key];
      }
    });
    return options;
  }

  static getName() {
    return '';
  }

  static getDescription() {
    return '';
  }

  static getSpac() {
    return {};
  }

  run() {
  }
}
