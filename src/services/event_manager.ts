import EventEmitter from 'events';
import camelCase from 'lodash/camelCase.js';
import { RuntimeException } from '../exceptions/index.ts';
import Logger from './logger.ts';
import ServiceInterface from './interface.ts';

interface EventListener {
  prefix: string;
  actions: string[];
}

/**
 * A strict version of EventEmitter
 * 1. listener must be a standard class
 * 2. unregistered event not allow to emit
 * 3. all events register and trigger will be recorded
 */
class EventManager extends ServiceInterface {
  logger: Logger;
  emitter: EventEmitter;
  events: Set<string>;

  static dependencies = [Logger];

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.emitter = new EventEmitter();
    this.events = new Set();
  }

  override getProto(): typeof EventEmitter {
    return EventEmitter;
  }

  getAllowEvents(): Set<string> {
    return this.events;
  }

  getEmitter(): EventEmitter {
    //TODO: 屏蔽写入
    return this.emitter;
  }

  /**
   * Allow to register a class such like
   * class Foo { get prefix(){ return 'foo'} get actions() { return ['bar']} }
   */
  addListener(ListenerClass: new () => EventListener): this {
    if (typeof ListenerClass !== 'function') {
      throw new RuntimeException('Not a standard listener input');
    }
    const listener = new ListenerClass();
    const { prefix, actions } = listener;
    if (!prefix || !actions) {
      throw new RuntimeException('Not a standard listener input');
    }

    const events: Record<string, string> = {};
    const eventsCount = this.events.size;
    for (const action of actions) {
      events[[prefix, action, 'before'].join(':')] = camelCase(['before', action].join('_'));
      events[[prefix, action, 'after'].join(':')] = camelCase(['after', action].join('_'));
    }

    //TODO: 用Set保存注册的事件
    for (const [eventName, callback] of Object.entries(events)) {
      this.events.add(eventName);
      if (Reflect.has(listener, callback) === false) {
        continue;
      }
      this.emitter.addListener(eventName, (listener as unknown as Record<string, (...args: unknown[]) => void>)[callback]);
    }

    if (eventsCount + Object.keys(events).length !== this.events.size) {
      throw new RuntimeException('Repeated event name has been registered, please check');
    }

    // this.logger.debug('Registered events', this.emitter.eventNames());
    return this;
  }

  emit(eventName: string, callback?: unknown): boolean {
    if (!this.events.has(eventName)) {
      throw new RuntimeException(`Event ${eventName} not registered yet`);
    }
    return this.emitter.emit(eventName, callback);
  }
}

export default EventManager;
