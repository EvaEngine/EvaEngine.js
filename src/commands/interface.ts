interface CommandArgv {
  $0: string;
  [key: string]: unknown;
}

export default class Command {
  argv: CommandArgv;
  options: Record<string, unknown> | null;

  constructor(argv: CommandArgv) {
    this.argv = argv;
    this.options = null;
  }

  getArgv(): CommandArgv {
    return this.argv;
  }

  setArgv(argv: CommandArgv): this {
    this.argv = argv;
    return this;
  }

  setOptions(options: Record<string, unknown>): this {
    this.options = options;
    return this;
  }

  getOptions(): Record<string, unknown> {
    const options: Record<string, unknown> = {};
    Object.keys(this.argv).forEach((key) => {
      if (key !== '$0' && ['string', 'number'].includes(typeof this.argv[key])) {
        options[key] = this.argv[key];
      }
    });
    return options;
  }

  static getName(): string {
    return '';
  }

  static getDescription(): string {
    return '';
  }

  static getSpec(): object {
    return {};
  }

  run(): void {
  }
}
