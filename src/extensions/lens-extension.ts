import type { InstalledExtension } from "./extension-manager";
import { action, observable, reaction } from "mobx";
import logger from "../main/logger";

export type LensExtensionId = string; // path to manifest (package.json)
export type LensExtensionConstructor = new (ext: InstalledExtension) => LensExtension;

export interface LensExtensionManifest {
  name: string;
  version: string;
  description?: string;
  main?: string; // path to %ext/dist/main.js
  renderer?: string; // path to %ext/dist/renderer.js
}

/**
 * LensExtension is an abstract class representing a loaded extensions.
 *
 * To make an extension, a new class that extends this class must be made and
 * must not have a different constructor type.
 */
export abstract class LensExtension {
  readonly manifest: LensExtensionManifest;
  readonly manifestPath: string;
  readonly isBundled: boolean;

  @observable private isEnabled = false;

  constructor({ manifest, manifestPath, isBundled }: InstalledExtension) {
    this.manifest = manifest;
    this.manifestPath = manifestPath;
    this.isBundled = !!isBundled;
  }

  get id(): LensExtensionId {
    return this.manifestPath;
  }

  get name() {
    return this.manifest.name;
  }

  get version() {
    return this.manifest.version;
  }

  get description() {
    return this.manifest.description;
  }

  @action
  async enable() {
    if (this.isEnabled) return;
    this.isEnabled = true;
    await this.onActivate();
    logger.info(`[EXTENSION]: enabled ${this.name}@${this.version}`);
  }

  @action
  async disable() {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    await this.onDeactivate();
    logger.info(`[EXTENSION]: disabled ${this.name}@${this.version}`);
  }

  toggle(enable?: boolean) {
    if (typeof enable === "boolean") {
      enable ? this.enable() : this.disable();
    } else {
      this.isEnabled ? this.disable() : this.enable();
    }
  }

  async whenEnabled(handlers: () => Function[]) {
    const disposers: Function[] = [];
    const unregisterHandlers = () => {
      disposers.forEach(unregister => unregister());
      disposers.length = 0;
    };
    const cancelReaction = reaction(() => this.isEnabled, isEnabled => {
      if (isEnabled) {
        disposers.push(...handlers());
      } else {
        unregisterHandlers();
      }
    }, {
      fireImmediately: true
    });
    return () => {
      unregisterHandlers();
      cancelReaction();
    };
  }

  protected abstract onActivate(): void | Promise<void>;

  protected abstract onDeactivate(): void | Promise<void>;
}