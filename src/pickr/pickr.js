/*! Pickr 1.9.1 MIT | https://github.com/Simonwep/pickr */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Pickr"] = factory();
	else
		root["Pickr"] = factory();
})(self, () => {
"use strict";

// ---- utils.js ----

function eventListener(method, elements, events, fn, options = {}) {
  if (elements instanceof HTMLCollection || elements instanceof NodeList) {
    elements = Array.from(elements);
  } else if (!Array.isArray(elements)) {
    elements = [elements];
  }
  if (!Array.isArray(events)) {
    events = [events];
  }
  for (const el of elements) {
    for (const ev of events) {
      el[method](ev, fn, { capture: false, ...options });
    }
  }
  return Array.prototype.slice.call(arguments, 1);
}

/**
 * Add event(s) to element(s).
 * @param elements DOM-Elements
 * @param events Event names
 * @param fn Callback
 * @param options Optional options
 * @return Array passed arguments
 */
const on = eventListener.bind(null, 'addEventListener');

/**
 * Remove event(s) from element(s).
 * @param elements DOM-Elements
 * @param events Event names
 * @param fn Callback
 * @param options Optional options
 * @return Array passed arguments
 */
const off = eventListener.bind(null, 'removeEventListener');

/**
 * Creates an DOM-Element out of a string (Single element).
 * @param html HTML representing a single element
 * @returns {Element | null} The element.
 */
function createElementFromString(html) {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild;
}

/**
 * Creates a new html element, every element which has
 * a ':ref' attribute will be saved in a object (which will be returned)
 * where the value of ':ref' is the object-key and the value the HTMLElement.
 *
 * It's possible to create a hierarchy if you add a ':obj' attribute. Every
 * sibling will be added to the object which will get the name from the 'data-con' attribute.
 *
 * @param str - The HTML String.
 */
function createFromTemplate(str) {
  // Removes an attribute from a HTMLElement and returns the value.
  const removeAttribute = (el, name) => {
    const value = el.getAttribute(name);
    el.removeAttribute(name);
    return value;
  };

  // Recursive function to resolve template
  const resolve = (element, base = {}) => {
    // Check key and container attribute
    const con = removeAttribute(element, ':obj');
    const key = removeAttribute(element, ':ref');
    const subtree = con ? base[con] = {} : base;

    // Check and save element
    key && (base[key] = element);
    for (const child of Array.from(element.children)) {
      const arr = removeAttribute(child, ':arr');
      const sub = resolve(child, arr ? {} : subtree);
      if (arr) {
        // Check if there is already an array and add element
        (subtree[arr] || (subtree[arr] = [])).push(Object.keys(sub).length ? sub : child);
      }
    }
    return base;
  };
  return resolve(createElementFromString(str));
}

/**
 * Polyfill for safari & firefox for the eventPath event property.
 * @param evt The event object.
 * @return [String] event path.
 */
function eventPath(evt) {
  let path = evt.path || evt.composedPath && evt.composedPath();
  if (path) {
    return path;
  }
  let el = evt.target.parentElement;
  path = [evt.target, el];
  while (el = el.parentElement) {
    path.push(el);
  }
  path.push(document, window);
  return path;
}

/**
 * Resolves a HTMLElement by query.
 * @param val
 * @returns {null|Document|Element}
 */
function resolveElement(val) {
  if (val instanceof Element) {
    return val;
  } else if (typeof val === 'string') {
    return val.split(/>>/g).reduce((pv, cv, ci, a) => {
      pv = pv.querySelector(cv);
      return ci < a.length - 1 ? pv.shadowRoot : pv;
    }, document);
  }
  return null;
}

// ---- color.js ----

const { min, max, floor, round } = Math;

/**
 * Convert HSV spectrum to RGB.
 * @param h Hue
 * @param s Saturation
 * @param v Value
 * @returns {number[]} Array with rgb values.
 */
function hsvToRgb(h, s, v) {
  h = h / 360 * 6;
  s /= 100;
  v /= 100;
  const i = floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const mod = i % 6;
  const r = [v, q, p, p, t, v][mod];
  const g = [t, v, v, q, p, p][mod];
  const b = [p, p, t, v, v, q][mod];
  return [r * 255, g * 255, b * 255];
}

/**
 * Convert HSV spectrum to Hex.
 * @param h Hue
 * @param s Saturation
 * @param v Value
 * @returns {string[]} Hex values
 */
function hsvToHex(h, s, v) {
  return hsvToRgb(h, s, v).map(v => round(v).toString(16).padStart(2, '0'));
}

/**
 * Convert RGB to HSV.
 * @param r Red
 * @param g Green
 * @param b Blue
 * @return {number[]} HSV values.
 */
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const minVal = min(r, g, b);
  const maxVal = max(r, g, b);
  const delta = maxVal - minVal;
  let h, s;
  const v = maxVal;
  if (delta === 0) {
    h = s = 0;
  } else {
    s = delta / maxVal;
    const dr = ((maxVal - r) / 6 + delta / 2) / delta;
    const dg = ((maxVal - g) / 6 + delta / 2) / delta;
    const db = ((maxVal - b) / 6 + delta / 2) / delta;
    if (r === maxVal) {
      h = db - dg;
    } else if (g === maxVal) {
      h = 1 / 3 + dr - db;
    } else if (b === maxVal) {
      h = 2 / 3 + dg - dr;
    }
    if (h < 0) {
      h += 1;
    } else if (h > 1) {
      h -= 1;
    }
  }
  return [h * 360, s * 100, v * 100];
}

/**
 * Convert HEX to HSV.
 * @param hex Hexadecimal string of rgb colors, can have length 3 or 6.
 * @return {number[]} HSV values.
 */
function hexToHsv(hex) {
  return rgbToHsv(...hex.match(/.{2}/g).map(v => parseInt(v, 16)));
}

/**
 * Try's to parse a string which represents a color to a HSV array.
 * Supported types: rgba, hsla, hsva, hexa.
 * @param str
 * @return {*}
 */
function parseToHSVA(str) {
  const regex = {
    rgba: /^rgba?\D+([\d.]+)(%?)\D+([\d.]+)(%?)\D+([\d.]+)(%?)\D*?(([\d.]+)(%?)|$)/i,
    hsla: /^hsla?\D+([\d.]+)\D+([\d.]+)\D+([\d.]+)\D*?(([\d.]+)(%?)|$)/i,
    hsva: /^hsva?\D+([\d.]+)\D+([\d.]+)\D+([\d.]+)\D*?(([\d.]+)(%?)|$)/i,
    hexa: /^#?(([\dA-Fa-f]{3,4})|([\dA-Fa-f]{6})|([\dA-Fa-f]{8}))$/i
  };

  const numarize = array => array.map(v => /^(|\d+)\.\d+|\d+$/.test(v) ? Number(v) : undefined);
  let match;
  invalid: for (const type in regex) {
    if (!(match = regex[type].exec(str))) {
      continue;
    }
    switch (type) {
      case 'rgba': {
        let [, r,, g,, b,,, a] = numarize(match);
        r = match[2] === '%' ? r / 100 * 255 : r;
        g = match[4] === '%' ? g / 100 * 255 : g;
        b = match[6] === '%' ? b / 100 * 255 : b;
        a = match[9] === '%' ? a / 100 : a;
        if (r > 255 || g > 255 || b > 255 || a < 0 || a > 1) {
          break invalid;
        }
        return { values: [...rgbToHsv(r, g, b), a], a, type };
      }
      case 'hexa': {
        let [, hex] = match;
        if (hex.length === 4 || hex.length === 3) {
          hex = hex.split('').map(v => v + v).join('');
        }
        const raw = hex.substring(0, 6);
        let a = hex.substring(6);
        // Convert 0 - 255 to 0 - 1 for opacity
        a = a ? parseInt(a, 16) / 255 : undefined;
        return { values: [...hexToHsv(raw), a], a, type };
      }
      case 'hsla': {
        let [, h, s, l,, a] = numarize(match);
        a = match[6] === '%' ? a / 100 : a;
        if (h > 360 || s > 100 || l > 100 || a < 0 || a > 1) {
          break invalid;
        }
        s /= 100;
        l /= 100;
        s *= l < 0.5 ? l : 1 - l;
        const ns = 2 * s / (l + s) * 100;
        const vv = (l + s) * 100;
        return { values: [h, isNaN(ns) ? 0 : ns, vv, a], a, type };
      }
      case 'hsva': {
        let [, h, s, v,, a] = numarize(match);
        a = match[6] === '%' ? a / 100 : a;
        if (h > 360 || s > 100 || v > 100 || a < 0 || a > 1) {
          break invalid;
        }
        return { values: [h, s, v, a], a, type };
      }
    }
  }
  return { values: null, type: null };
}

// ---- hsvacolor.js ----

/**
 * Simple class which holds the properties
 * of the color represention model hsva (hue saturation value alpha)
 */
function HSVaColor(h = 0, s = 0, v = 0, a = 1) {
  const mapper = (original, next) => (precision = -1) => {
    return next(~precision ? original.map(v => Number(v.toFixed(precision))) : original);
  };
  const that = {
    h, s, v, a,
    toHSVA() {
      const hsva = [that.h, that.s, that.v, that.a];
      hsva.toString = mapper(hsva, arr => `hsva(${arr[0]}, ${arr[1]}%, ${arr[2]}%, ${that.a})`);
      return hsva;
    },
    toRGBA() {
      const rgba = [...hsvToRgb(that.h, that.s, that.v), that.a];
      rgba.toString = mapper(rgba, arr => `rgba(${arr[0]}, ${arr[1]}, ${arr[2]}, ${that.a})`);
      return rgba;
    },
    toHEXA() {
      const hex = hsvToHex(that.h, that.s, that.v);
      // Check if alpha channel make sense, convert it to 255 number space, convert
      // To hex and pad it with zeros if needet.
      const alpha = that.a >= 1 ? '' : Number((that.a * 255).toFixed(0)).toString(16).toUpperCase().padStart(2, '0');
      alpha && hex.push(alpha);
      hex.toString = () => `#${hex.join('').toUpperCase()}`;
      return hex;
    },
    clone: () => HSVaColor(that.h, that.s, that.v, that.a)
  };
  return that;
}

// ---- moveable.js ----

const clamp = v => Math.max(Math.min(v, 1), 0);
function Moveable(opt) {
  const that = {
    options: Object.assign({
      lock: null,
      onchange: () => 0,
      onstop: () => 0
    }, opt),
    _keyboard(e) {
      const { options } = that;
      const { type, key } = e;

      // Check to see if the Movable is focused and then move it based on arrow key inputs
      // For improved accessibility
      if (document.activeElement === options.wrapper) {
        const { lock } = that.options;
        const up = key === 'ArrowUp';
        const right = key === 'ArrowRight';
        const down = key === 'ArrowDown';
        const left = key === 'ArrowLeft';
        if (type === 'keydown' && (up || right || down || left)) {
          let xm = 0;
          let ym = 0;
          if (lock === 'v') {
            xm = up || right ? 1 : -1;
          } else if (lock === 'h') {
            xm = up || right ? -1 : 1;
          } else {
            ym = up ? -1 : down ? 1 : 0;
            xm = left ? -1 : right ? 1 : 0;
          }
          that.update(clamp(that.cache.x + 0.01 * xm), clamp(that.cache.y + 0.01 * ym));
          e.preventDefault();
        } else if (key.startsWith('Arrow')) {
          that.options.onstop();
          e.preventDefault();
        }
      }
    },
    _tapstart(evt) {
      on(document, ['mouseup', 'touchend', 'touchcancel'], that._tapstop);
      on(document, ['mousemove', 'touchmove'], that._tapmove);
      if (evt.cancelable) {
        evt.preventDefault();
      }
      // Trigger
      that._tapmove(evt);
    },
    _tapmove(evt) {
      const { options, cache } = that;
      const { lock, element, wrapper } = options;
      const b = wrapper.getBoundingClientRect();
      let x = 0, y = 0;
      if (evt) {
        const touch = evt && evt.touches && evt.touches[0];
        x = evt ? (touch || evt).clientX : 0;
        y = evt ? (touch || evt).clientY : 0;

        // Reset to bounds
        if (x < b.left) {
          x = b.left;
        } else if (x > b.left + b.width) {
          x = b.left + b.width;
        }
        if (y < b.top) {
          y = b.top;
        } else if (y > b.top + b.height) {
          y = b.top + b.height;
        }

        // Normalize
        x -= b.left;
        y -= b.top;
      } else if (cache) {
        x = cache.x * b.width;
        y = cache.y * b.height;
      }
      if (lock !== 'h') {
        element.style.left = `calc(${x / b.width * 100}% - ${element.offsetWidth / 2}px)`;
      }
      if (lock !== 'v') {
        element.style.top = `calc(${y / b.height * 100}% - ${element.offsetHeight / 2}px)`;
      }
      that.cache = { x: x / b.width, y: y / b.height };
      const cx = clamp(x / b.width);
      const cy = clamp(y / b.height);
      switch (lock) {
        case 'v': return options.onchange(cx);
        case 'h': return options.onchange(cy);
        default:  return options.onchange(cx, cy);
      }
    },
    _tapstop() {
      that.options.onstop();
      off(document, ['mouseup', 'touchend', 'touchcancel'], that._tapstop);
      off(document, ['mousemove', 'touchmove'], that._tapmove);
    },
    trigger() {
      that._tapmove();
    },
    update(x = 0, y = 0) {
      const { left, top, width, height } = that.options.wrapper.getBoundingClientRect();
      if (that.options.lock === 'h') {
        y = x;
      }
      that._tapmove({
        clientX: left + width * x,
        clientY: top + height * y
      });
    },
    destroy() {
      const { options, _tapstart, _keyboard } = that;
      off(document, ['keydown', 'keyup'], _keyboard);
      off([options.wrapper, options.element], 'mousedown', _tapstart);
      off([options.wrapper, options.element], 'touchstart', _tapstart, { passive: false });
    }
  };

  // Initilize
  const { options, _tapstart, _keyboard } = that;
  on([options.wrapper, options.element], 'mousedown', _tapstart);
  on([options.wrapper, options.element], 'touchstart', _tapstart, { passive: false });
  on(document, ['keydown', 'keyup'], _keyboard);
  return that;
}

// ---- template.js ----

const template = (instance => {
  const { components, useAsButton, appClass, theme } = instance.options;

  // Utils
  const hidden = con => con ? '' : 'style="display:none" hidden';
  const t = str => instance._t(str);
  const root = createFromTemplate(`
    <div :ref="root" class="pickr">

      ${useAsButton ? '' : '<button type="button" :ref="button" class="pcr-button"></button>'}

      <div :ref="app" class="pcr-app ${appClass || ''}" data-theme="${theme}" aria-label="${t('ui:dialog', 'color picker dialog')}" role="window">
        <div class="pcr-selection" ${hidden(components.palette)}>
          <div :obj="preview" class="pcr-color-preview" ${hidden(components.preview)}>
            <button type="button" :ref="lastColor" class="pcr-last-color" aria-label="${t('btn:last-color')}"></button>
            <div :ref="currentColor" class="pcr-current-color"></div>
          </div>

          <div :obj="palette" class="pcr-color-palette">
            <div :ref="picker" class="pcr-picker"></div>
            <div :ref="palette" class="pcr-palette" tabindex="0" aria-label="${t('aria:palette')}" role="listbox"></div>
          </div>

          <div :obj="hue" class="pcr-color-chooser" ${hidden(components.hue)}>
            <div :ref="picker" class="pcr-picker"></div>
            <div :ref="slider" class="pcr-hue pcr-slider" tabindex="0" aria-label="${t('aria:hue')}" role="slider"></div>
          </div>
        </div>

        <div :obj="interaction" class="pcr-interaction" ${hidden(Object.keys(components.interaction).length)}>
          <input :ref="result" class="pcr-result" type="text" spellcheck="false" ${hidden(components.interaction.input)} aria-label="${t('aria:input', 'color input field')}">
          <input :ref="save" class="pcr-save" value="${t('btn:save')}" type="button" ${hidden(components.interaction.save)} aria-label="${t('aria:btn:save')}">
        </div>
      </div>
    </div>
  `);

  return root;
});

// ---- pickr.js ----

class Pickr {
  // Assign version and export
  static version = "1.9.1";

  // Default strings
  static I18N_DEFAULTS = {
    // Strings visible in the UI
    'ui:dialog': 'color picker dialog',
    'btn:toggle': 'toggle color picker dialog',
    'btn:last-color': 'use previous color',
    'btn:save': 'Save',
    // Strings used for aria-labels
    'aria:btn:save': 'save and close',
    'aria:input': 'color input field',
    'aria:palette': 'color selection area',
    'aria:hue': 'hue selection slider',
  };

  // Default options
  static DEFAULT_OPTIONS = {
    appClass: null,
    theme: 'classic',
    useAsButton: false,
    padding: 8,
    disabled: false,
    comparison: true,
    outputPrecision: 0,
    container: 'body',
    components: {
      interaction: {}
    },
    i18n: {},
    default: '#42445a',
    position: 'bottom-middle',
  };

  // Will be used to prevent specific actions during initilization
  _initializingActive = true;

  // If the current color value should be recalculated
  _recalc = true;

  // Positioning engine and DOM-Tree
  _root = null;

  // Current and last color for comparison
  _color = HSVaColor();
  _lastColor = HSVaColor();

  // Animation frame used for setup.
  // Will be cancelled in case of destruction.
  _setupAnimationFrame = null;

  // Evenlistener name: [callbacks]
  _eventListener = {
    init: [],
    save: [],
    hide: [],
    show: [],
    change: [],
    changestop: [],
  };

  constructor(opt) {
    // Assign default values
    this.options = opt = Object.assign({ ...Pickr.DEFAULT_OPTIONS }, opt);
    const { components } = opt;

    // Check interaction section
    if (!components.interaction) {
      components.interaction = {};
    }

    // Overwrite palette if preview, opacity or hue are true
    const { preview, hue, palette } = components;
    components.palette = palette || preview || hue;

    // Initialize picker
    this._preBuild();
    this._buildComponents();
    this._bindEvents();
    this._finalBuild();

    // Initialize accessibility
    const { button, app } = this._root;
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', this._t('btn:toggle'));

    // Initilization is finish, pickr is visible and ready for usage
    const that = this;
    this._setupAnimationFrame = requestAnimationFrame(function cb() {
      // TODO: Performance issue due to high call-rate?
      if (!app.isConnected) {
        return requestAnimationFrame(cb);
      }

      // Apply default color
      that.setColor(opt.default);

      // Initialization is done - pickr is usable, fire init event
      that._initializingActive = false;
      that._emit('init');
    });
  }

  // Create instance via method
  static create = options => new Pickr(options);

  // Does only the absolutly basic thing to initialize the components
  _preBuild() {
    const { options } = this;

    // Resolve elements
    for (const type of ['el', 'container']) {
      options[type] = resolveElement(options[type]);
    }

    // Create element and append it to body to
    // Prevent initialization errors
    this._root = template(this);

    // Check if a custom button is used
    if (options.useAsButton) {
      this._root.button = options.el; // Replace button with customized button
    }
    options.container.appendChild(this._root.root);
  }

  _finalBuild() {
    const opt = this.options;
    const root = this._root;

    // Remove from body
    opt.container.removeChild(root.root);
    opt.container.appendChild(root.app);

    // Don't replace the the element if a custom button is used
    if (!opt.useAsButton) {
      // Replace element with actual color-picker
      opt.el.parentNode.replaceChild(root.root, opt.el);
    }

    this.hide();
  }

  _buildComponents() {
    // Instance reference
    const inst = this;
    const cs = this.options.components;

    // Re-assign if null
    const getColor = () => this._color || (this._color = this._lastColor.clone());
    const components = {
      palette: Moveable({
        element: inst._root.palette.picker,
        wrapper: inst._root.palette.palette,
        onstop: () => inst._emit('changestop', 'slider', inst),
        onchange(x, y) {
          if (!cs.palette) {
            return;
          }
          const color = getColor();
          const { _root, options } = inst;
          const { lastColor, currentColor } = _root.preview;

          // Update the input field only if the user is currently not typing
          if (inst._recalc) {
            // Calculate saturation based on the position
            color.s = x * 100;

            // Calculate the value
            color.v = 100 - y * 100;

            // Prevent falling under zero
            color.v < 0 ? color.v = 0 : 0;
            inst._updateOutput('slider');
          }

          // Set picker and gradient color
          const cssRGBaString = color.toRGBA().toString(0);
          this.element.style.background = cssRGBaString;
          this.wrapper.style.background = `
            linear-gradient(to top, rgba(0, 0, 0, ${color.a}), transparent),
            linear-gradient(to left, hsla(${color.h}, 100%, 50%, ${color.a}), rgba(255, 255, 255, ${color.a}))
          `;

          // Check if color is locked
          if (!options.comparison) {
            _root.button.style.setProperty('--pcr-color', cssRGBaString);

            // If the user changes the color, remove the cleared icon
            _root.button.classList.remove('clear');
          } else if (!options.useAsButton && !inst._lastColor) {
            // Apply color to both the last and current color since the current state is cleared
            lastColor.style.setProperty('--pcr-color', cssRGBaString);
          }

          // Change current color
          currentColor.style.setProperty('--pcr-color', cssRGBaString);
        }
      }),
      hue: Moveable({
        lock: 'h',
        element: inst._root.hue.picker,
        wrapper: inst._root.hue.slider,
        onstop: () => inst._emit('changestop', 'slider', inst),
        onchange(v) {
          if (!cs.hue || !cs.palette) {
            return;
          }
          const color = getColor();

          // Calculate hue
          if (inst._recalc) {
            color.h = v * 360;
          }

          // Update color
          this.element.style.backgroundColor = `hsl(${color.h}, 100%, 50%)`;
          components.palette.trigger();
        }
      }),
    };
    this._components = components;
  }

  _bindEvents() {
    const { _root, options } = this;
    const eventBindings = [
      // Select last color on click
      on(_root.preview.lastColor, 'click', () => {
        this.setHSVA(...(this._lastColor || this._color).toHSVA(), true);
      }),
      // Save color
      on(_root.interaction.save, 'click', () => {
        !this.applyColor() && this.hide();
      }),
      // User input
      on(_root.interaction.result, ['keyup', 'input'], e => {
        // Fire listener if initialization is finish and changed color was valid
        if (this.setColor(e.target.value, true) && !this._initializingActive) {
          this._emit('change', this._color, 'input', this);
          this._emit('changestop', 'input', this);
        }
        e.stopImmediatePropagation();
      }),
      // Detect user input and disable auto-recalculation
      on(_root.interaction.result, ['focus', 'blur'], e => {
        this._recalc = e.type === 'blur';
        this._recalc && this._updateOutput(null);
      }),
      // Cancel input detection on color change
      on([_root.palette.palette, _root.palette.picker, _root.hue.slider, _root.hue.picker], ['mousedown', 'touchstart'], () => this._recalc = true, {
        passive: true
      }),
      // Save and hide / show picker
      on(_root.button, 'click', () => this.isOpen() ? this.hide() : this.show()),
      // Close with escape key
      on(document, 'keyup', e => this.isOpen() && (e.key === 'Escape' || e.code === 'Escape') && this.hide()),
      // Cancel selecting if the user taps behind the color picker
      on(document, ['touchstart', 'mousedown'], e => {
        if (this.isOpen() && !eventPath(e).some(el => el === _root.app || el === _root.button)) {
          this.hide();
        }
      }, { capture: true }),
    ];

    // Save bindings
    this._eventBindings = eventBindings;
  }

  _rePositioningPicker() {
    // 自動再配置を無効化（位置はCSSで固定）
  }

  _updateOutput(eventSource) {
    const { _root, _color, options } = this;

    // Update input field with current HEXA value
    if (_root.interaction.result) {
      _root.interaction.result.value = _color.toHEXA().toString(options.outputPrecision);
    }

    // Fire listener if initialization is finish
    if (!this._initializingActive && this._recalc) {
      this._emit('change', _color, eventSource, this);
    }
  }

  _parseLocalColor(str) {
    const { values, type, a } = parseToHSVA(str);
    const alphaMakesAChange = a !== undefined && a !== 1;

    // If no opacity is applied, add undefined at the very end which gets
    // Set to 1 in setHSVA
    if (values && values.length === 3) {
      values[3] = undefined;
    }
    return {
      values: !values || alphaMakesAChange ? null : values,
      type
    };
  }

  _t(key) {
    return this.options.i18n[key] || Pickr.I18N_DEFAULTS[key];
  }

  _emit(event, ...args) {
    this._eventListener[event].forEach(cb => cb(...args, this));
  }

  on(event, cb) {
    this._eventListener[event].push(cb);
    return this;
  }

  off(event, cb) {
    const callBacks = this._eventListener[event] || [];
    const index = callBacks.indexOf(cb);
    if (~index) {
      callBacks.splice(index, 1);
    }
    return this;
  }

  applyColor(silent = false) {
    const { preview, button } = this._root;

    // Change preview and current color
    const cssRGBaString = this._color.toRGBA().toString(0);
    preview.lastColor.style.setProperty('--pcr-color', cssRGBaString);

    // Change only the button color if it isn't customized
    if (!this.options.useAsButton) {
      button.style.setProperty('--pcr-color', cssRGBaString);
    }

    // User changed the color so remove the clear class
    button.classList.remove('clear');

    // Save last color
    this._lastColor = this._color.clone();

    // Fire listener
    if (!this._initializingActive && !silent) {
      this._emit('save', this._color);
    }
    return this;
  }

  /**
   * Destroy's all functionalitys
   */
  destroy() {
    // Cancel setup-frame if set
    cancelAnimationFrame(this._setupAnimationFrame);

    // Unbind events
    this._eventBindings.forEach(args => off(...args));

    // Destroy sub-components
    Object.keys(this._components).forEach(key => this._components[key].destroy());
  }

  /**
   * Destroy's all functionalitys and removes
   * the pickr element.
   */
  destroyAndRemove() {
    this.destroy();
    const { root, app } = this._root;

    // Remove element
    if (root.parentElement) {
      root.parentElement.removeChild(root);
    }

    // Remove .pcr-app
    app.parentElement.removeChild(app);

    // There are references to various DOM elements stored in the pickr instance
    // This cleans all of them to avoid detached DOMs
    Object.keys(this).forEach(key => this[key] = null);
  }

  /**
   * Hides the color-picker ui.
   */
  hide() {
    if (this.isOpen()) {
      this._root.app.classList.remove('visible');
      this._emit('hide');
      return true;
    }
    return false;
  }

  /**
   * Shows the color-picker ui.
   */
  show() {
    if (!this.options.disabled && !this.isOpen()) {
      this._root.app.classList.add('visible');
      this._rePositioningPicker();
      this._emit('show', this._color);
      return this;
    }
    return false;
  }

  /**
   * @return {boolean} If the color picker is currently open
   */
  isOpen() {
    return this._root.app.classList.contains('visible');
  }

  /**
   * Set a specific color.
   * @param h Hue
   * @param s Saturation
   * @param v Value
   * @param a Alpha channel (0 - 1)
   * @param silent If the button should not change the color
   * @return boolean if the color has been accepted
   */
  setHSVA(h = 360, s = 0, v = 0, a = 1, silent = false) {
    // Deactivate color calculation
    const recalc = this._recalc; // Save state
    this._recalc = false;

    // Validate input
    if (h < 0 || h > 360 || s < 0 || s > 100 || v < 0 || v > 100 || a < 0 || a > 1) {
      return false;
    }

    // Override current color and re-active color calculation
    this._color = HSVaColor(h, s, v, a);

    // Update slider and palette
    const { hue, palette } = this._components;
    hue.update(h / 360);
    palette.update(s / 100, 1 - v / 100);

    // Check if call is silent
    if (!silent) {
      this.applyColor();
    }

    // Update output if recalculation is enabled
    if (recalc) {
      this._updateOutput();
    }

    // Restore old state
    this._recalc = recalc;
    return true;
  }

  /**
   * Tries to parse a string which represents a color.
   * Examples: #fff
   *           rgb 10 10 200
   *           hsva 10 20 5 0.5
   * @param string
   * @param silent
   */
  setColor(string, silent = false) {
    const { values, type } = this._parseLocalColor(string);

    // Check if color is ok
    if (values) {
      // Update color (fires 'save' event if silent is 'false')
      if (!this.setHSVA(...values, silent)) {
        return false;
      }
      return true;
    }
    return false;
  }
}

return Pickr;
});
//# sourceMappingURL=pickr.min.js.map
