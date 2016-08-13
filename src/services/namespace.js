import { Dependencies } from 'constitute';
import { createNamespace, getNamespace, destroyNamespace, reset } from 'continuation-local-storage';
import Config from './config';
import { UnsupportedOperationException } from '../exceptions';

const stores = {};

export class Store {
  get() {
    return null;
  }

  set() {
    return this;
  }

  bind() {
    return this;
  }

  reset() {
    return this;
  }

  active() {
  }

  run(callback) {
    return callback();
  }

  bindEmitter() {
    return this;
  }

  getContext() {
    throw new UnsupportedOperationException(
      'Not able to get namespace context when it be disabled');
  }

  createContext() {
  }
}

export class NullStore extends Store {
}

export class NsStore extends Store {
  constructor(name) {
    super();
    this.name = name;
    createNamespace(name);
  }

  get(key) {
    return getNamespace(this.name).get(key);
  }

  set(key, value) {
    getNamespace(this.name).set(key, value);
    return this;
  }

  bind(...args) {
    return getNamespace(this.name).bind(...args);
  }

  active() {
    return getNamespace(this.name).active();
  }

  run(...args) {
    return getNamespace(this.name).run(...args);
  }

  bindEmitter(...args) {
    return getNamespace(this.name).bindEmitter(...args);
  }

  getContext() {
    return getNamespace(this.name);
  }

  createContext() {
    return getNamespace(this.name).createContext();
  }

  reset() {
    reset(this.name);
    return this;
  }
}

@Dependencies(Config) //eslint-disable-line new-cap
export default class Namespace {
  /**
   * @param config {Config}
   */
  constructor(config) {
    this.config = config.get('namespace');
    this.defaultName = config.defaultName || 'eva.ns';
    this.store = null;
    this.name = null;
  }

  isEnabled() {
    return this.config.enable;
  }

  getDefaultName() {
    return this.defaultName;
  }

  setDefaultName(name) {
    this.defaultName = name;
    return this;
  }

  getName() {
    return this.name;
  }

  /**
   * @returns {Store}
   */
  getStore() {
    if ({}.hasOwnProperty.call(stores, this.name)) {
      return stores[this.name];
    }
    stores[this.name] = this.config.enable === true ?
      new NsStore(this.name) : new NullStore(this.name);
    return stores[this.name];
  }

  destroy(name) {
    destroyNamespace(name);
    delete stores[name];
    return this;
  }

  use(ns) {
    this.name = ns || this.defaultName;
    return this.getStore();
  }

  get(key) {
    return this.use().get(key);
  }

  set(key, value) {
    return this.use().set(key, value);
  }

  bind(...args) {
    return this.use().bind(...args);
  }

  active() {
    return this.use().active();
  }

  run(...args) {
    return this.use().run(...args);
  }

  bindEmitter(...args) {
    return this.use().bindEmitter(...args);
  }

  createContext() {
    return this.use().createContext();
  }
}
