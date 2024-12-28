/**
 * @license Angular v19.0.5
 * (c) 2010-2024 Google LLC. https://angular.io/
 * License: MIT
 */
const _SELECTOR_REGEXP = new RegExp(
  `(\\:not\\()|(([\\.\\#]?)[-\\w]+)|(?:\\[([-.\\w*\\\\$]+)(?:=(["']?)([^\\]"']*)\\5)?\\])|(\\))|(\\s*,\\s*)`,
  // 8: ","
  "g"
);
class CssSelector {
  element = null;
  classNames = [];
  /**
   * The selectors are encoded in pairs where:
   * - even locations are attribute names
   * - odd locations are attribute values.
   *
   * Example:
   * Selector: `[key1=value1][key2]` would parse to:
   * ```
   * ['key1', 'value1', 'key2', '']
   * ```
   */
  attrs = [];
  notSelectors = [];
  static parse(selector) {
    const results = [];
    const _addResult = (res, cssSel) => {
      if (cssSel.notSelectors.length > 0 && !cssSel.element && cssSel.classNames.length == 0 && cssSel.attrs.length == 0) {
        cssSel.element = "*";
      }
      res.push(cssSel);
    };
    let cssSelector = new CssSelector();
    let match;
    let current = cssSelector;
    let inNot = false;
    _SELECTOR_REGEXP.lastIndex = 0;
    while (match = _SELECTOR_REGEXP.exec(selector)) {
      if (match[
        1
        /* SelectorRegexp.NOT */
      ]) {
        if (inNot) {
          throw new Error("Nesting :not in a selector is not allowed");
        }
        inNot = true;
        current = new CssSelector();
        cssSelector.notSelectors.push(current);
      }
      const tag = match[
        2
        /* SelectorRegexp.TAG */
      ];
      if (tag) {
        const prefix = match[
          3
          /* SelectorRegexp.PREFIX */
        ];
        if (prefix === "#") {
          current.addAttribute("id", tag.slice(1));
        } else if (prefix === ".") {
          current.addClassName(tag.slice(1));
        } else {
          current.setElement(tag);
        }
      }
      const attribute2 = match[
        4
        /* SelectorRegexp.ATTRIBUTE */
      ];
      if (attribute2) {
        current.addAttribute(current.unescapeAttribute(attribute2), match[
          6
          /* SelectorRegexp.ATTRIBUTE_VALUE */
        ]);
      }
      if (match[
        7
        /* SelectorRegexp.NOT_END */
      ]) {
        inNot = false;
        current = cssSelector;
      }
      if (match[
        8
        /* SelectorRegexp.SEPARATOR */
      ]) {
        if (inNot) {
          throw new Error("Multiple selectors in :not are not supported");
        }
        _addResult(results, cssSelector);
        cssSelector = current = new CssSelector();
      }
    }
    _addResult(results, cssSelector);
    return results;
  }
  /**
   * Unescape `\$` sequences from the CSS attribute selector.
   *
   * This is needed because `$` can have a special meaning in CSS selectors,
   * but we might want to match an attribute that contains `$`.
   * [MDN web link for more
   * info](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors).
   * @param attr the attribute to unescape.
   * @returns the unescaped string.
   */
  unescapeAttribute(attr) {
    let result = "";
    let escaping = false;
    for (let i = 0; i < attr.length; i++) {
      const char = attr.charAt(i);
      if (char === "\\") {
        escaping = true;
        continue;
      }
      if (char === "$" && !escaping) {
        throw new Error(`Error in attribute selector "${attr}". Unescaped "$" is not supported. Please escape with "\\$".`);
      }
      escaping = false;
      result += char;
    }
    return result;
  }
  /**
   * Escape `$` sequences from the CSS attribute selector.
   *
   * This is needed because `$` can have a special meaning in CSS selectors,
   * with this method we are escaping `$` with `\$'.
   * [MDN web link for more
   * info](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors).
   * @param attr the attribute to escape.
   * @returns the escaped string.
   */
  escapeAttribute(attr) {
    return attr.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
  }
  isElementSelector() {
    return this.hasElementSelector() && this.classNames.length == 0 && this.attrs.length == 0 && this.notSelectors.length === 0;
  }
  hasElementSelector() {
    return !!this.element;
  }
  setElement(element2 = null) {
    this.element = element2;
  }
  getAttrs() {
    const result = [];
    if (this.classNames.length > 0) {
      result.push("class", this.classNames.join(" "));
    }
    return result.concat(this.attrs);
  }
  addAttribute(name, value = "") {
    this.attrs.push(name, value && value.toLowerCase() || "");
  }
  addClassName(name) {
    this.classNames.push(name.toLowerCase());
  }
  toString() {
    let res = this.element || "";
    if (this.classNames) {
      this.classNames.forEach((klass) => res += `.${klass}`);
    }
    if (this.attrs) {
      for (let i = 0; i < this.attrs.length; i += 2) {
        const name = this.escapeAttribute(this.attrs[i]);
        const value = this.attrs[i + 1];
        res += `[${name}${value ? "=" + value : ""}]`;
      }
    }
    this.notSelectors.forEach((notSelector) => res += `:not(${notSelector})`);
    return res;
  }
}
class SelectorMatcher {
  static createNotMatcher(notSelectors) {
    const notMatcher = new SelectorMatcher();
    notMatcher.addSelectables(notSelectors, null);
    return notMatcher;
  }
  _elementMap = /* @__PURE__ */ new Map();
  _elementPartialMap = /* @__PURE__ */ new Map();
  _classMap = /* @__PURE__ */ new Map();
  _classPartialMap = /* @__PURE__ */ new Map();
  _attrValueMap = /* @__PURE__ */ new Map();
  _attrValuePartialMap = /* @__PURE__ */ new Map();
  _listContexts = [];
  addSelectables(cssSelectors, callbackCtxt) {
    let listContext = null;
    if (cssSelectors.length > 1) {
      listContext = new SelectorListContext(cssSelectors);
      this._listContexts.push(listContext);
    }
    for (let i = 0; i < cssSelectors.length; i++) {
      this._addSelectable(cssSelectors[i], callbackCtxt, listContext);
    }
  }
  /**
   * Add an object that can be found later on by calling `match`.
   * @param cssSelector A css selector
   * @param callbackCtxt An opaque object that will be given to the callback of the `match` function
   */
  _addSelectable(cssSelector, callbackCtxt, listContext) {
    let matcher = this;
    const element2 = cssSelector.element;
    const classNames = cssSelector.classNames;
    const attrs = cssSelector.attrs;
    const selectable = new SelectorContext(cssSelector, callbackCtxt, listContext);
    if (element2) {
      const isTerminal = attrs.length === 0 && classNames.length === 0;
      if (isTerminal) {
        this._addTerminal(matcher._elementMap, element2, selectable);
      } else {
        matcher = this._addPartial(matcher._elementPartialMap, element2);
      }
    }
    if (classNames) {
      for (let i = 0; i < classNames.length; i++) {
        const isTerminal = attrs.length === 0 && i === classNames.length - 1;
        const className = classNames[i];
        if (isTerminal) {
          this._addTerminal(matcher._classMap, className, selectable);
        } else {
          matcher = this._addPartial(matcher._classPartialMap, className);
        }
      }
    }
    if (attrs) {
      for (let i = 0; i < attrs.length; i += 2) {
        const isTerminal = i === attrs.length - 2;
        const name = attrs[i];
        const value = attrs[i + 1];
        if (isTerminal) {
          const terminalMap = matcher._attrValueMap;
          let terminalValuesMap = terminalMap.get(name);
          if (!terminalValuesMap) {
            terminalValuesMap = /* @__PURE__ */ new Map();
            terminalMap.set(name, terminalValuesMap);
          }
          this._addTerminal(terminalValuesMap, value, selectable);
        } else {
          const partialMap = matcher._attrValuePartialMap;
          let partialValuesMap = partialMap.get(name);
          if (!partialValuesMap) {
            partialValuesMap = /* @__PURE__ */ new Map();
            partialMap.set(name, partialValuesMap);
          }
          matcher = this._addPartial(partialValuesMap, value);
        }
      }
    }
  }
  _addTerminal(map, name, selectable) {
    let terminalList = map.get(name);
    if (!terminalList) {
      terminalList = [];
      map.set(name, terminalList);
    }
    terminalList.push(selectable);
  }
  _addPartial(map, name) {
    let matcher = map.get(name);
    if (!matcher) {
      matcher = new SelectorMatcher();
      map.set(name, matcher);
    }
    return matcher;
  }
  /**
   * Find the objects that have been added via `addSelectable`
   * whose css selector is contained in the given css selector.
   * @param cssSelector A css selector
   * @param matchedCallback This callback will be called with the object handed into `addSelectable`
   * @return boolean true if a match was found
   */
  match(cssSelector, matchedCallback) {
    let result = false;
    const element2 = cssSelector.element;
    const classNames = cssSelector.classNames;
    const attrs = cssSelector.attrs;
    for (let i = 0; i < this._listContexts.length; i++) {
      this._listContexts[i].alreadyMatched = false;
    }
    result = this._matchTerminal(this._elementMap, element2, cssSelector, matchedCallback) || result;
    result = this._matchPartial(this._elementPartialMap, element2, cssSelector, matchedCallback) || result;
    if (classNames) {
      for (let i = 0; i < classNames.length; i++) {
        const className = classNames[i];
        result = this._matchTerminal(this._classMap, className, cssSelector, matchedCallback) || result;
        result = this._matchPartial(this._classPartialMap, className, cssSelector, matchedCallback) || result;
      }
    }
    if (attrs) {
      for (let i = 0; i < attrs.length; i += 2) {
        const name = attrs[i];
        const value = attrs[i + 1];
        const terminalValuesMap = this._attrValueMap.get(name);
        if (value) {
          result = this._matchTerminal(terminalValuesMap, "", cssSelector, matchedCallback) || result;
        }
        result = this._matchTerminal(terminalValuesMap, value, cssSelector, matchedCallback) || result;
        const partialValuesMap = this._attrValuePartialMap.get(name);
        if (value) {
          result = this._matchPartial(partialValuesMap, "", cssSelector, matchedCallback) || result;
        }
        result = this._matchPartial(partialValuesMap, value, cssSelector, matchedCallback) || result;
      }
    }
    return result;
  }
  /** @internal */
  _matchTerminal(map, name, cssSelector, matchedCallback) {
    if (!map || typeof name !== "string") {
      return false;
    }
    let selectables = map.get(name) || [];
    const starSelectables = map.get("*");
    if (starSelectables) {
      selectables = selectables.concat(starSelectables);
    }
    if (selectables.length === 0) {
      return false;
    }
    let selectable;
    let result = false;
    for (let i = 0; i < selectables.length; i++) {
      selectable = selectables[i];
      result = selectable.finalize(cssSelector, matchedCallback) || result;
    }
    return result;
  }
  /** @internal */
  _matchPartial(map, name, cssSelector, matchedCallback) {
    if (!map || typeof name !== "string") {
      return false;
    }
    const nestedSelector = map.get(name);
    if (!nestedSelector) {
      return false;
    }
    return nestedSelector.match(cssSelector, matchedCallback);
  }
}
class SelectorListContext {
  selectors;
  alreadyMatched = false;
  constructor(selectors) {
    this.selectors = selectors;
  }
}
class SelectorContext {
  selector;
  cbContext;
  listContext;
  notSelectors;
  constructor(selector, cbContext, listContext) {
    this.selector = selector;
    this.cbContext = cbContext;
    this.listContext = listContext;
    this.notSelectors = selector.notSelectors;
  }
  finalize(cssSelector, callback) {
    let result = true;
    if (this.notSelectors.length > 0 && (!this.listContext || !this.listContext.alreadyMatched)) {
      const notMatcher = SelectorMatcher.createNotMatcher(this.notSelectors);
      result = !notMatcher.match(cssSelector, null);
    }
    if (result && callback && (!this.listContext || !this.listContext.alreadyMatched)) {
      if (this.listContext) {
        this.listContext.alreadyMatched = true;
      }
      callback(this.selector, this.cbContext);
    }
    return result;
  }
}
const emitDistinctChangesOnlyDefaultValue = true;
var ViewEncapsulation;
(function(ViewEncapsulation2) {
  ViewEncapsulation2[ViewEncapsulation2["Emulated"] = 0] = "Emulated";
  ViewEncapsulation2[ViewEncapsulation2["None"] = 2] = "None";
  ViewEncapsulation2[ViewEncapsulation2["ShadowDom"] = 3] = "ShadowDom";
})(ViewEncapsulation || (ViewEncapsulation = {}));
var ChangeDetectionStrategy;
(function(ChangeDetectionStrategy2) {
  ChangeDetectionStrategy2[ChangeDetectionStrategy2["OnPush"] = 0] = "OnPush";
  ChangeDetectionStrategy2[ChangeDetectionStrategy2["Default"] = 1] = "Default";
})(ChangeDetectionStrategy || (ChangeDetectionStrategy = {}));
var InputFlags;
(function(InputFlags2) {
  InputFlags2[InputFlags2["None"] = 0] = "None";
  InputFlags2[InputFlags2["SignalBased"] = 1] = "SignalBased";
  InputFlags2[InputFlags2["HasDecoratorInputTransform"] = 2] = "HasDecoratorInputTransform";
})(InputFlags || (InputFlags = {}));
const CUSTOM_ELEMENTS_SCHEMA = {
  name: "custom-elements"
};
const NO_ERRORS_SCHEMA = {
  name: "no-errors-schema"
};
const Type$1 = Function;
var SecurityContext;
(function(SecurityContext2) {
  SecurityContext2[SecurityContext2["NONE"] = 0] = "NONE";
  SecurityContext2[SecurityContext2["HTML"] = 1] = "HTML";
  SecurityContext2[SecurityContext2["STYLE"] = 2] = "STYLE";
  SecurityContext2[SecurityContext2["SCRIPT"] = 3] = "SCRIPT";
  SecurityContext2[SecurityContext2["URL"] = 4] = "URL";
  SecurityContext2[SecurityContext2["RESOURCE_URL"] = 5] = "RESOURCE_URL";
})(SecurityContext || (SecurityContext = {}));
var MissingTranslationStrategy;
(function(MissingTranslationStrategy2) {
  MissingTranslationStrategy2[MissingTranslationStrategy2["Error"] = 0] = "Error";
  MissingTranslationStrategy2[MissingTranslationStrategy2["Warning"] = 1] = "Warning";
  MissingTranslationStrategy2[MissingTranslationStrategy2["Ignore"] = 2] = "Ignore";
})(MissingTranslationStrategy || (MissingTranslationStrategy = {}));
function parserSelectorToSimpleSelector(selector) {
  const classes = selector.classNames && selector.classNames.length ? [8, ...selector.classNames] : [];
  const elementName = selector.element && selector.element !== "*" ? selector.element : "";
  return [elementName, ...selector.attrs, ...classes];
}
function parserSelectorToNegativeSelector(selector) {
  const classes = selector.classNames && selector.classNames.length ? [8, ...selector.classNames] : [];
  if (selector.element) {
    return [
      1 | 4,
      selector.element,
      ...selector.attrs,
      ...classes
    ];
  } else if (selector.attrs.length) {
    return [1 | 2, ...selector.attrs, ...classes];
  } else {
    return selector.classNames && selector.classNames.length ? [1 | 8, ...selector.classNames] : [];
  }
}
function parserSelectorToR3Selector(selector) {
  const positive = parserSelectorToSimpleSelector(selector);
  const negative = selector.notSelectors && selector.notSelectors.length ? selector.notSelectors.map((notSelector) => parserSelectorToNegativeSelector(notSelector)) : [];
  return positive.concat(...negative);
}
function parseSelectorToR3Selector(selector) {
  return selector ? CssSelector.parse(selector).map(parserSelectorToR3Selector) : [];
}
var core = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  emitDistinctChangesOnlyDefaultValue,
  get ViewEncapsulation() {
    return ViewEncapsulation;
  },
  get ChangeDetectionStrategy() {
    return ChangeDetectionStrategy;
  },
  get InputFlags() {
    return InputFlags;
  },
  CUSTOM_ELEMENTS_SCHEMA,
  NO_ERRORS_SCHEMA,
  Type: Type$1,
  get SecurityContext() {
    return SecurityContext;
  },
  get MissingTranslationStrategy() {
    return MissingTranslationStrategy;
  },
  parseSelectorToR3Selector
});
let textEncoder;
function digest$1(message) {
  return message.id || computeDigest(message);
}
function computeDigest(message) {
  return sha1(serializeNodes(message.nodes).join("") + `[${message.meaning}]`);
}
function decimalDigest(message) {
  return message.id || computeDecimalDigest(message);
}
function computeDecimalDigest(message) {
  const visitor = new _SerializerIgnoreIcuExpVisitor();
  const parts = message.nodes.map((a) => a.visit(visitor, null));
  return computeMsgId(parts.join(""), message.meaning);
}
class _SerializerVisitor {
  visitText(text2, context) {
    return text2.value;
  }
  visitContainer(container, context) {
    return `[${container.children.map((child) => child.visit(this)).join(", ")}]`;
  }
  visitIcu(icu, context) {
    const strCases = Object.keys(icu.cases).map((k) => `${k} {${icu.cases[k].visit(this)}}`);
    return `{${icu.expression}, ${icu.type}, ${strCases.join(", ")}}`;
  }
  visitTagPlaceholder(ph, context) {
    return ph.isVoid ? `<ph tag name="${ph.startName}"/>` : `<ph tag name="${ph.startName}">${ph.children.map((child) => child.visit(this)).join(", ")}</ph name="${ph.closeName}">`;
  }
  visitPlaceholder(ph, context) {
    return ph.value ? `<ph name="${ph.name}">${ph.value}</ph>` : `<ph name="${ph.name}"/>`;
  }
  visitIcuPlaceholder(ph, context) {
    return `<ph icu name="${ph.name}">${ph.value.visit(this)}</ph>`;
  }
  visitBlockPlaceholder(ph, context) {
    return `<ph block name="${ph.startName}">${ph.children.map((child) => child.visit(this)).join(", ")}</ph name="${ph.closeName}">`;
  }
}
const serializerVisitor$1 = new _SerializerVisitor();
function serializeNodes(nodes) {
  return nodes.map((a) => a.visit(serializerVisitor$1, null));
}
class _SerializerIgnoreIcuExpVisitor extends _SerializerVisitor {
  visitIcu(icu) {
    let strCases = Object.keys(icu.cases).map((k) => `${k} {${icu.cases[k].visit(this)}}`);
    return `{${icu.type}, ${strCases.join(", ")}}`;
  }
}
function sha1(str) {
  textEncoder ??= new TextEncoder();
  const utf8 = [...textEncoder.encode(str)];
  const words32 = bytesToWords32(utf8, Endian.Big);
  const len = utf8.length * 8;
  const w = new Uint32Array(80);
  let a = 1732584193, b = 4023233417, c = 2562383102, d = 271733878, e = 3285377520;
  words32[len >> 5] |= 128 << 24 - len % 32;
  words32[(len + 64 >> 9 << 4) + 15] = len;
  for (let i = 0; i < words32.length; i += 16) {
    const h0 = a, h1 = b, h2 = c, h3 = d, h4 = e;
    for (let j = 0; j < 80; j++) {
      if (j < 16) {
        w[j] = words32[i + j];
      } else {
        w[j] = rol32(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      }
      const fkVal = fk(j, b, c, d);
      const f = fkVal[0];
      const k = fkVal[1];
      const temp = [rol32(a, 5), f, e, k, w[j]].reduce(add32);
      e = d;
      d = c;
      c = rol32(b, 30);
      b = a;
      a = temp;
    }
    a = add32(a, h0);
    b = add32(b, h1);
    c = add32(c, h2);
    d = add32(d, h3);
    e = add32(e, h4);
  }
  return toHexU32(a) + toHexU32(b) + toHexU32(c) + toHexU32(d) + toHexU32(e);
}
function toHexU32(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}
function fk(index, b, c, d) {
  if (index < 20) {
    return [b & c | ~b & d, 1518500249];
  }
  if (index < 40) {
    return [b ^ c ^ d, 1859775393];
  }
  if (index < 60) {
    return [b & c | b & d | c & d, 2400959708];
  }
  return [b ^ c ^ d, 3395469782];
}
function fingerprint(str) {
  textEncoder ??= new TextEncoder();
  const utf8 = textEncoder.encode(str);
  const view = new DataView(utf8.buffer, utf8.byteOffset, utf8.byteLength);
  let hi = hash32(view, utf8.length, 0);
  let lo = hash32(view, utf8.length, 102072);
  if (hi == 0 && (lo == 0 || lo == 1)) {
    hi = hi ^ 319790063;
    lo = lo ^ -1801410264;
  }
  return BigInt.asUintN(32, BigInt(hi)) << BigInt(32) | BigInt.asUintN(32, BigInt(lo));
}
function computeMsgId(msg, meaning = "") {
  let msgFingerprint = fingerprint(msg);
  if (meaning) {
    msgFingerprint = BigInt.asUintN(64, msgFingerprint << BigInt(1)) | msgFingerprint >> BigInt(63) & BigInt(1);
    msgFingerprint += fingerprint(meaning);
  }
  return BigInt.asUintN(63, msgFingerprint).toString();
}
function hash32(view, length, c) {
  let a = 2654435769, b = 2654435769;
  let index = 0;
  const end = length - 12;
  for (; index <= end; index += 12) {
    a += view.getUint32(index, true);
    b += view.getUint32(index + 4, true);
    c += view.getUint32(index + 8, true);
    const res = mix(a, b, c);
    a = res[0], b = res[1], c = res[2];
  }
  const remainder = length - index;
  c += length;
  if (remainder >= 4) {
    a += view.getUint32(index, true);
    index += 4;
    if (remainder >= 8) {
      b += view.getUint32(index, true);
      index += 4;
      if (remainder >= 9) {
        c += view.getUint8(index++) << 8;
      }
      if (remainder >= 10) {
        c += view.getUint8(index++) << 16;
      }
      if (remainder === 11) {
        c += view.getUint8(index++) << 24;
      }
    } else {
      if (remainder >= 5) {
        b += view.getUint8(index++);
      }
      if (remainder >= 6) {
        b += view.getUint8(index++) << 8;
      }
      if (remainder === 7) {
        b += view.getUint8(index++) << 16;
      }
    }
  } else {
    if (remainder >= 1) {
      a += view.getUint8(index++);
    }
    if (remainder >= 2) {
      a += view.getUint8(index++) << 8;
    }
    if (remainder === 3) {
      a += view.getUint8(index++) << 16;
    }
  }
  return mix(a, b, c)[2];
}
function mix(a, b, c) {
  a -= b;
  a -= c;
  a ^= c >>> 13;
  b -= c;
  b -= a;
  b ^= a << 8;
  c -= a;
  c -= b;
  c ^= b >>> 13;
  a -= b;
  a -= c;
  a ^= c >>> 12;
  b -= c;
  b -= a;
  b ^= a << 16;
  c -= a;
  c -= b;
  c ^= b >>> 5;
  a -= b;
  a -= c;
  a ^= c >>> 3;
  b -= c;
  b -= a;
  b ^= a << 10;
  c -= a;
  c -= b;
  c ^= b >>> 15;
  return [a, b, c];
}
var Endian;
(function(Endian2) {
  Endian2[Endian2["Little"] = 0] = "Little";
  Endian2[Endian2["Big"] = 1] = "Big";
})(Endian || (Endian = {}));
function add32(a, b) {
  return add32to64(a, b)[1];
}
function add32to64(a, b) {
  const low = (a & 65535) + (b & 65535);
  const high = (a >>> 16) + (b >>> 16) + (low >>> 16);
  return [high >>> 16, high << 16 | low & 65535];
}
function rol32(a, count) {
  return a << count | a >>> 32 - count;
}
function bytesToWords32(bytes, endian) {
  const size = bytes.length + 3 >>> 2;
  const words32 = [];
  for (let i = 0; i < size; i++) {
    words32[i] = wordAt(bytes, i * 4, endian);
  }
  return words32;
}
function byteAt(bytes, index) {
  return index >= bytes.length ? 0 : bytes[index];
}
function wordAt(bytes, index, endian) {
  let word = 0;
  if (endian === Endian.Big) {
    for (let i = 0; i < 4; i++) {
      word += byteAt(bytes, index + i) << 24 - 8 * i;
    }
  } else {
    for (let i = 0; i < 4; i++) {
      word += byteAt(bytes, index + i) << 8 * i;
    }
  }
  return word;
}
var TypeModifier;
(function(TypeModifier2) {
  TypeModifier2[TypeModifier2["None"] = 0] = "None";
  TypeModifier2[TypeModifier2["Const"] = 1] = "Const";
})(TypeModifier || (TypeModifier = {}));
class Type {
  modifiers;
  constructor(modifiers = TypeModifier.None) {
    this.modifiers = modifiers;
  }
  hasModifier(modifier) {
    return (this.modifiers & modifier) !== 0;
  }
}
var BuiltinTypeName;
(function(BuiltinTypeName2) {
  BuiltinTypeName2[BuiltinTypeName2["Dynamic"] = 0] = "Dynamic";
  BuiltinTypeName2[BuiltinTypeName2["Bool"] = 1] = "Bool";
  BuiltinTypeName2[BuiltinTypeName2["String"] = 2] = "String";
  BuiltinTypeName2[BuiltinTypeName2["Int"] = 3] = "Int";
  BuiltinTypeName2[BuiltinTypeName2["Number"] = 4] = "Number";
  BuiltinTypeName2[BuiltinTypeName2["Function"] = 5] = "Function";
  BuiltinTypeName2[BuiltinTypeName2["Inferred"] = 6] = "Inferred";
  BuiltinTypeName2[BuiltinTypeName2["None"] = 7] = "None";
})(BuiltinTypeName || (BuiltinTypeName = {}));
class BuiltinType extends Type {
  name;
  constructor(name, modifiers) {
    super(modifiers);
    this.name = name;
  }
  visitType(visitor, context) {
    return visitor.visitBuiltinType(this, context);
  }
}
class ExpressionType extends Type {
  value;
  typeParams;
  constructor(value, modifiers, typeParams = null) {
    super(modifiers);
    this.value = value;
    this.typeParams = typeParams;
  }
  visitType(visitor, context) {
    return visitor.visitExpressionType(this, context);
  }
}
class ArrayType extends Type {
  of;
  constructor(of, modifiers) {
    super(modifiers);
    this.of = of;
  }
  visitType(visitor, context) {
    return visitor.visitArrayType(this, context);
  }
}
class MapType extends Type {
  valueType;
  constructor(valueType, modifiers) {
    super(modifiers);
    this.valueType = valueType || null;
  }
  visitType(visitor, context) {
    return visitor.visitMapType(this, context);
  }
}
class TransplantedType extends Type {
  type;
  constructor(type, modifiers) {
    super(modifiers);
    this.type = type;
  }
  visitType(visitor, context) {
    return visitor.visitTransplantedType(this, context);
  }
}
const DYNAMIC_TYPE = new BuiltinType(BuiltinTypeName.Dynamic);
const INFERRED_TYPE = new BuiltinType(BuiltinTypeName.Inferred);
const BOOL_TYPE = new BuiltinType(BuiltinTypeName.Bool);
const INT_TYPE = new BuiltinType(BuiltinTypeName.Int);
const NUMBER_TYPE = new BuiltinType(BuiltinTypeName.Number);
const STRING_TYPE = new BuiltinType(BuiltinTypeName.String);
const FUNCTION_TYPE = new BuiltinType(BuiltinTypeName.Function);
const NONE_TYPE = new BuiltinType(BuiltinTypeName.None);
var UnaryOperator;
(function(UnaryOperator2) {
  UnaryOperator2[UnaryOperator2["Minus"] = 0] = "Minus";
  UnaryOperator2[UnaryOperator2["Plus"] = 1] = "Plus";
})(UnaryOperator || (UnaryOperator = {}));
var BinaryOperator;
(function(BinaryOperator2) {
  BinaryOperator2[BinaryOperator2["Equals"] = 0] = "Equals";
  BinaryOperator2[BinaryOperator2["NotEquals"] = 1] = "NotEquals";
  BinaryOperator2[BinaryOperator2["Identical"] = 2] = "Identical";
  BinaryOperator2[BinaryOperator2["NotIdentical"] = 3] = "NotIdentical";
  BinaryOperator2[BinaryOperator2["Minus"] = 4] = "Minus";
  BinaryOperator2[BinaryOperator2["Plus"] = 5] = "Plus";
  BinaryOperator2[BinaryOperator2["Divide"] = 6] = "Divide";
  BinaryOperator2[BinaryOperator2["Multiply"] = 7] = "Multiply";
  BinaryOperator2[BinaryOperator2["Modulo"] = 8] = "Modulo";
  BinaryOperator2[BinaryOperator2["And"] = 9] = "And";
  BinaryOperator2[BinaryOperator2["Or"] = 10] = "Or";
  BinaryOperator2[BinaryOperator2["BitwiseOr"] = 11] = "BitwiseOr";
  BinaryOperator2[BinaryOperator2["BitwiseAnd"] = 12] = "BitwiseAnd";
  BinaryOperator2[BinaryOperator2["Lower"] = 13] = "Lower";
  BinaryOperator2[BinaryOperator2["LowerEquals"] = 14] = "LowerEquals";
  BinaryOperator2[BinaryOperator2["Bigger"] = 15] = "Bigger";
  BinaryOperator2[BinaryOperator2["BiggerEquals"] = 16] = "BiggerEquals";
  BinaryOperator2[BinaryOperator2["NullishCoalesce"] = 17] = "NullishCoalesce";
})(BinaryOperator || (BinaryOperator = {}));
function nullSafeIsEquivalent(base, other) {
  if (base == null || other == null) {
    return base == other;
  }
  return base.isEquivalent(other);
}
function areAllEquivalentPredicate(base, other, equivalentPredicate) {
  const len = base.length;
  if (len !== other.length) {
    return false;
  }
  for (let i = 0; i < len; i++) {
    if (!equivalentPredicate(base[i], other[i])) {
      return false;
    }
  }
  return true;
}
function areAllEquivalent(base, other) {
  return areAllEquivalentPredicate(base, other, (baseElement, otherElement) => baseElement.isEquivalent(otherElement));
}
class Expression {
  type;
  sourceSpan;
  constructor(type, sourceSpan) {
    this.type = type || null;
    this.sourceSpan = sourceSpan || null;
  }
  prop(name, sourceSpan) {
    return new ReadPropExpr(this, name, null, sourceSpan);
  }
  key(index, type, sourceSpan) {
    return new ReadKeyExpr(this, index, type, sourceSpan);
  }
  callFn(params, sourceSpan, pure) {
    return new InvokeFunctionExpr(this, params, null, sourceSpan, pure);
  }
  instantiate(params, type, sourceSpan) {
    return new InstantiateExpr(this, params, type, sourceSpan);
  }
  conditional(trueCase, falseCase = null, sourceSpan) {
    return new ConditionalExpr(this, trueCase, falseCase, null, sourceSpan);
  }
  equals(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Equals, this, rhs, null, sourceSpan);
  }
  notEquals(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.NotEquals, this, rhs, null, sourceSpan);
  }
  identical(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Identical, this, rhs, null, sourceSpan);
  }
  notIdentical(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.NotIdentical, this, rhs, null, sourceSpan);
  }
  minus(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Minus, this, rhs, null, sourceSpan);
  }
  plus(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Plus, this, rhs, null, sourceSpan);
  }
  divide(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Divide, this, rhs, null, sourceSpan);
  }
  multiply(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Multiply, this, rhs, null, sourceSpan);
  }
  modulo(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Modulo, this, rhs, null, sourceSpan);
  }
  and(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.And, this, rhs, null, sourceSpan);
  }
  bitwiseOr(rhs, sourceSpan, parens = true) {
    return new BinaryOperatorExpr(BinaryOperator.BitwiseOr, this, rhs, null, sourceSpan, parens);
  }
  bitwiseAnd(rhs, sourceSpan, parens = true) {
    return new BinaryOperatorExpr(BinaryOperator.BitwiseAnd, this, rhs, null, sourceSpan, parens);
  }
  or(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Or, this, rhs, null, sourceSpan);
  }
  lower(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Lower, this, rhs, null, sourceSpan);
  }
  lowerEquals(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.LowerEquals, this, rhs, null, sourceSpan);
  }
  bigger(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.Bigger, this, rhs, null, sourceSpan);
  }
  biggerEquals(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.BiggerEquals, this, rhs, null, sourceSpan);
  }
  isBlank(sourceSpan) {
    return this.equals(TYPED_NULL_EXPR, sourceSpan);
  }
  nullishCoalesce(rhs, sourceSpan) {
    return new BinaryOperatorExpr(BinaryOperator.NullishCoalesce, this, rhs, null, sourceSpan);
  }
  toStmt() {
    return new ExpressionStatement(this, null);
  }
}
class ReadVarExpr extends Expression {
  name;
  constructor(name, type, sourceSpan) {
    super(type, sourceSpan);
    this.name = name;
  }
  isEquivalent(e) {
    return e instanceof ReadVarExpr && this.name === e.name;
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitReadVarExpr(this, context);
  }
  clone() {
    return new ReadVarExpr(this.name, this.type, this.sourceSpan);
  }
  set(value) {
    return new WriteVarExpr(this.name, value, null, this.sourceSpan);
  }
}
class TypeofExpr extends Expression {
  expr;
  constructor(expr, type, sourceSpan) {
    super(type, sourceSpan);
    this.expr = expr;
  }
  visitExpression(visitor, context) {
    return visitor.visitTypeofExpr(this, context);
  }
  isEquivalent(e) {
    return e instanceof TypeofExpr && e.expr.isEquivalent(this.expr);
  }
  isConstant() {
    return this.expr.isConstant();
  }
  clone() {
    return new TypeofExpr(this.expr.clone());
  }
}
class WrappedNodeExpr extends Expression {
  node;
  constructor(node, type, sourceSpan) {
    super(type, sourceSpan);
    this.node = node;
  }
  isEquivalent(e) {
    return e instanceof WrappedNodeExpr && this.node === e.node;
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitWrappedNodeExpr(this, context);
  }
  clone() {
    return new WrappedNodeExpr(this.node, this.type, this.sourceSpan);
  }
}
class WriteVarExpr extends Expression {
  name;
  value;
  constructor(name, value, type, sourceSpan) {
    super(type || value.type, sourceSpan);
    this.name = name;
    this.value = value;
  }
  isEquivalent(e) {
    return e instanceof WriteVarExpr && this.name === e.name && this.value.isEquivalent(e.value);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitWriteVarExpr(this, context);
  }
  clone() {
    return new WriteVarExpr(this.name, this.value.clone(), this.type, this.sourceSpan);
  }
  toDeclStmt(type, modifiers) {
    return new DeclareVarStmt(this.name, this.value, type, modifiers, this.sourceSpan);
  }
  toConstDecl() {
    return this.toDeclStmt(INFERRED_TYPE, StmtModifier.Final);
  }
}
class WriteKeyExpr extends Expression {
  receiver;
  index;
  value;
  constructor(receiver, index, value, type, sourceSpan) {
    super(type || value.type, sourceSpan);
    this.receiver = receiver;
    this.index = index;
    this.value = value;
  }
  isEquivalent(e) {
    return e instanceof WriteKeyExpr && this.receiver.isEquivalent(e.receiver) && this.index.isEquivalent(e.index) && this.value.isEquivalent(e.value);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitWriteKeyExpr(this, context);
  }
  clone() {
    return new WriteKeyExpr(this.receiver.clone(), this.index.clone(), this.value.clone(), this.type, this.sourceSpan);
  }
}
class WritePropExpr extends Expression {
  receiver;
  name;
  value;
  constructor(receiver, name, value, type, sourceSpan) {
    super(type || value.type, sourceSpan);
    this.receiver = receiver;
    this.name = name;
    this.value = value;
  }
  isEquivalent(e) {
    return e instanceof WritePropExpr && this.receiver.isEquivalent(e.receiver) && this.name === e.name && this.value.isEquivalent(e.value);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitWritePropExpr(this, context);
  }
  clone() {
    return new WritePropExpr(this.receiver.clone(), this.name, this.value.clone(), this.type, this.sourceSpan);
  }
}
class InvokeFunctionExpr extends Expression {
  fn;
  args;
  pure;
  constructor(fn2, args, type, sourceSpan, pure = false) {
    super(type, sourceSpan);
    this.fn = fn2;
    this.args = args;
    this.pure = pure;
  }
  // An alias for fn, which allows other logic to handle calls and property reads together.
  get receiver() {
    return this.fn;
  }
  isEquivalent(e) {
    return e instanceof InvokeFunctionExpr && this.fn.isEquivalent(e.fn) && areAllEquivalent(this.args, e.args) && this.pure === e.pure;
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitInvokeFunctionExpr(this, context);
  }
  clone() {
    return new InvokeFunctionExpr(this.fn.clone(), this.args.map((arg) => arg.clone()), this.type, this.sourceSpan, this.pure);
  }
}
class TaggedTemplateExpr extends Expression {
  tag;
  template;
  constructor(tag, template2, type, sourceSpan) {
    super(type, sourceSpan);
    this.tag = tag;
    this.template = template2;
  }
  isEquivalent(e) {
    return e instanceof TaggedTemplateExpr && this.tag.isEquivalent(e.tag) && areAllEquivalentPredicate(this.template.elements, e.template.elements, (a, b) => a.text === b.text) && areAllEquivalent(this.template.expressions, e.template.expressions);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitTaggedTemplateExpr(this, context);
  }
  clone() {
    return new TaggedTemplateExpr(this.tag.clone(), this.template.clone(), this.type, this.sourceSpan);
  }
}
class InstantiateExpr extends Expression {
  classExpr;
  args;
  constructor(classExpr, args, type, sourceSpan) {
    super(type, sourceSpan);
    this.classExpr = classExpr;
    this.args = args;
  }
  isEquivalent(e) {
    return e instanceof InstantiateExpr && this.classExpr.isEquivalent(e.classExpr) && areAllEquivalent(this.args, e.args);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitInstantiateExpr(this, context);
  }
  clone() {
    return new InstantiateExpr(this.classExpr.clone(), this.args.map((arg) => arg.clone()), this.type, this.sourceSpan);
  }
}
class LiteralExpr extends Expression {
  value;
  constructor(value, type, sourceSpan) {
    super(type, sourceSpan);
    this.value = value;
  }
  isEquivalent(e) {
    return e instanceof LiteralExpr && this.value === e.value;
  }
  isConstant() {
    return true;
  }
  visitExpression(visitor, context) {
    return visitor.visitLiteralExpr(this, context);
  }
  clone() {
    return new LiteralExpr(this.value, this.type, this.sourceSpan);
  }
}
class TemplateLiteral {
  elements;
  expressions;
  constructor(elements, expressions) {
    this.elements = elements;
    this.expressions = expressions;
  }
  clone() {
    return new TemplateLiteral(this.elements.map((el) => el.clone()), this.expressions.map((expr) => expr.clone()));
  }
}
class TemplateLiteralElement {
  text;
  sourceSpan;
  rawText;
  constructor(text2, sourceSpan, rawText) {
    this.text = text2;
    this.sourceSpan = sourceSpan;
    this.rawText = rawText ?? sourceSpan?.toString() ?? escapeForTemplateLiteral(escapeSlashes(text2));
  }
  clone() {
    return new TemplateLiteralElement(this.text, this.sourceSpan, this.rawText);
  }
}
class LiteralPiece {
  text;
  sourceSpan;
  constructor(text2, sourceSpan) {
    this.text = text2;
    this.sourceSpan = sourceSpan;
  }
}
class PlaceholderPiece {
  text;
  sourceSpan;
  associatedMessage;
  /**
   * Create a new instance of a `PlaceholderPiece`.
   *
   * @param text the name of this placeholder (e.g. `PH_1`).
   * @param sourceSpan the location of this placeholder in its localized message the source code.
   * @param associatedMessage reference to another message that this placeholder is associated with.
   * The `associatedMessage` is mainly used to provide a relationship to an ICU message that has
   * been extracted out from the message containing the placeholder.
   */
  constructor(text2, sourceSpan, associatedMessage) {
    this.text = text2;
    this.sourceSpan = sourceSpan;
    this.associatedMessage = associatedMessage;
  }
}
const MEANING_SEPARATOR$1 = "|";
const ID_SEPARATOR$1 = "@@";
const LEGACY_ID_INDICATOR = "␟";
class LocalizedString extends Expression {
  metaBlock;
  messageParts;
  placeHolderNames;
  expressions;
  constructor(metaBlock, messageParts, placeHolderNames, expressions, sourceSpan) {
    super(STRING_TYPE, sourceSpan);
    this.metaBlock = metaBlock;
    this.messageParts = messageParts;
    this.placeHolderNames = placeHolderNames;
    this.expressions = expressions;
  }
  isEquivalent(e) {
    return false;
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitLocalizedString(this, context);
  }
  clone() {
    return new LocalizedString(this.metaBlock, this.messageParts, this.placeHolderNames, this.expressions.map((expr) => expr.clone()), this.sourceSpan);
  }
  /**
   * Serialize the given `meta` and `messagePart` into "cooked" and "raw" strings that can be used
   * in a `$localize` tagged string. The format of the metadata is the same as that parsed by
   * `parseI18nMeta()`.
   *
   * @param meta The metadata to serialize
   * @param messagePart The first part of the tagged string
   */
  serializeI18nHead() {
    let metaBlock = this.metaBlock.description || "";
    if (this.metaBlock.meaning) {
      metaBlock = `${this.metaBlock.meaning}${MEANING_SEPARATOR$1}${metaBlock}`;
    }
    if (this.metaBlock.customId) {
      metaBlock = `${metaBlock}${ID_SEPARATOR$1}${this.metaBlock.customId}`;
    }
    if (this.metaBlock.legacyIds) {
      this.metaBlock.legacyIds.forEach((legacyId) => {
        metaBlock = `${metaBlock}${LEGACY_ID_INDICATOR}${legacyId}`;
      });
    }
    return createCookedRawString(metaBlock, this.messageParts[0].text, this.getMessagePartSourceSpan(0));
  }
  getMessagePartSourceSpan(i) {
    return this.messageParts[i]?.sourceSpan ?? this.sourceSpan;
  }
  getPlaceholderSourceSpan(i) {
    return this.placeHolderNames[i]?.sourceSpan ?? this.expressions[i]?.sourceSpan ?? this.sourceSpan;
  }
  /**
   * Serialize the given `placeholderName` and `messagePart` into "cooked" and "raw" strings that
   * can be used in a `$localize` tagged string.
   *
   * The format is `:<placeholder-name>[@@<associated-id>]:`.
   *
   * The `associated-id` is the message id of the (usually an ICU) message to which this placeholder
   * refers.
   *
   * @param partIndex The index of the message part to serialize.
   */
  serializeI18nTemplatePart(partIndex) {
    const placeholder = this.placeHolderNames[partIndex - 1];
    const messagePart = this.messageParts[partIndex];
    let metaBlock = placeholder.text;
    if (placeholder.associatedMessage?.legacyIds.length === 0) {
      metaBlock += `${ID_SEPARATOR$1}${computeMsgId(placeholder.associatedMessage.messageString, placeholder.associatedMessage.meaning)}`;
    }
    return createCookedRawString(metaBlock, messagePart.text, this.getMessagePartSourceSpan(partIndex));
  }
}
const escapeSlashes = (str) => str.replace(/\\/g, "\\\\");
const escapeStartingColon = (str) => str.replace(/^:/, "\\:");
const escapeColons = (str) => str.replace(/:/g, "\\:");
const escapeForTemplateLiteral = (str) => str.replace(/`/g, "\\`").replace(/\${/g, "$\\{");
function createCookedRawString(metaBlock, messagePart, range) {
  if (metaBlock === "") {
    return {
      cooked: messagePart,
      raw: escapeForTemplateLiteral(escapeStartingColon(escapeSlashes(messagePart))),
      range
    };
  } else {
    return {
      cooked: `:${metaBlock}:${messagePart}`,
      raw: escapeForTemplateLiteral(`:${escapeColons(escapeSlashes(metaBlock))}:${escapeSlashes(messagePart)}`),
      range
    };
  }
}
class ExternalExpr extends Expression {
  value;
  typeParams;
  constructor(value, type, typeParams = null, sourceSpan) {
    super(type, sourceSpan);
    this.value = value;
    this.typeParams = typeParams;
  }
  isEquivalent(e) {
    return e instanceof ExternalExpr && this.value.name === e.value.name && this.value.moduleName === e.value.moduleName;
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitExternalExpr(this, context);
  }
  clone() {
    return new ExternalExpr(this.value, this.type, this.typeParams, this.sourceSpan);
  }
}
class ExternalReference {
  moduleName;
  name;
  constructor(moduleName, name) {
    this.moduleName = moduleName;
    this.name = name;
  }
}
class ConditionalExpr extends Expression {
  condition;
  falseCase;
  trueCase;
  constructor(condition, trueCase, falseCase = null, type, sourceSpan) {
    super(type || trueCase.type, sourceSpan);
    this.condition = condition;
    this.falseCase = falseCase;
    this.trueCase = trueCase;
  }
  isEquivalent(e) {
    return e instanceof ConditionalExpr && this.condition.isEquivalent(e.condition) && this.trueCase.isEquivalent(e.trueCase) && nullSafeIsEquivalent(this.falseCase, e.falseCase);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitConditionalExpr(this, context);
  }
  clone() {
    return new ConditionalExpr(this.condition.clone(), this.trueCase.clone(), this.falseCase?.clone(), this.type, this.sourceSpan);
  }
}
class DynamicImportExpr extends Expression {
  url;
  urlComment;
  constructor(url, sourceSpan, urlComment) {
    super(null, sourceSpan);
    this.url = url;
    this.urlComment = urlComment;
  }
  isEquivalent(e) {
    return e instanceof DynamicImportExpr && this.url === e.url && this.urlComment === e.urlComment;
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitDynamicImportExpr(this, context);
  }
  clone() {
    return new DynamicImportExpr(typeof this.url === "string" ? this.url : this.url.clone(), this.sourceSpan, this.urlComment);
  }
}
class NotExpr extends Expression {
  condition;
  constructor(condition, sourceSpan) {
    super(BOOL_TYPE, sourceSpan);
    this.condition = condition;
  }
  isEquivalent(e) {
    return e instanceof NotExpr && this.condition.isEquivalent(e.condition);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitNotExpr(this, context);
  }
  clone() {
    return new NotExpr(this.condition.clone(), this.sourceSpan);
  }
}
class FnParam {
  name;
  type;
  constructor(name, type = null) {
    this.name = name;
    this.type = type;
  }
  isEquivalent(param) {
    return this.name === param.name;
  }
  clone() {
    return new FnParam(this.name, this.type);
  }
}
class FunctionExpr extends Expression {
  params;
  statements;
  name;
  constructor(params, statements, type, sourceSpan, name) {
    super(type, sourceSpan);
    this.params = params;
    this.statements = statements;
    this.name = name;
  }
  isEquivalent(e) {
    return (e instanceof FunctionExpr || e instanceof DeclareFunctionStmt) && areAllEquivalent(this.params, e.params) && areAllEquivalent(this.statements, e.statements);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitFunctionExpr(this, context);
  }
  toDeclStmt(name, modifiers) {
    return new DeclareFunctionStmt(name, this.params, this.statements, this.type, modifiers, this.sourceSpan);
  }
  clone() {
    return new FunctionExpr(this.params.map((p) => p.clone()), this.statements, this.type, this.sourceSpan, this.name);
  }
}
class ArrowFunctionExpr extends Expression {
  params;
  body;
  // Note that `body: Expression` represents `() => expr` whereas
  // `body: Statement[]` represents `() => { expr }`.
  constructor(params, body, type, sourceSpan) {
    super(type, sourceSpan);
    this.params = params;
    this.body = body;
  }
  isEquivalent(e) {
    if (!(e instanceof ArrowFunctionExpr) || !areAllEquivalent(this.params, e.params)) {
      return false;
    }
    if (this.body instanceof Expression && e.body instanceof Expression) {
      return this.body.isEquivalent(e.body);
    }
    if (Array.isArray(this.body) && Array.isArray(e.body)) {
      return areAllEquivalent(this.body, e.body);
    }
    return false;
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitArrowFunctionExpr(this, context);
  }
  clone() {
    return new ArrowFunctionExpr(this.params.map((p) => p.clone()), Array.isArray(this.body) ? this.body : this.body.clone(), this.type, this.sourceSpan);
  }
  toDeclStmt(name, modifiers) {
    return new DeclareVarStmt(name, this, INFERRED_TYPE, modifiers, this.sourceSpan);
  }
}
class UnaryOperatorExpr extends Expression {
  operator;
  expr;
  parens;
  constructor(operator, expr, type, sourceSpan, parens = true) {
    super(type || NUMBER_TYPE, sourceSpan);
    this.operator = operator;
    this.expr = expr;
    this.parens = parens;
  }
  isEquivalent(e) {
    return e instanceof UnaryOperatorExpr && this.operator === e.operator && this.expr.isEquivalent(e.expr);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitUnaryOperatorExpr(this, context);
  }
  clone() {
    return new UnaryOperatorExpr(this.operator, this.expr.clone(), this.type, this.sourceSpan, this.parens);
  }
}
class BinaryOperatorExpr extends Expression {
  operator;
  rhs;
  parens;
  lhs;
  constructor(operator, lhs, rhs, type, sourceSpan, parens = true) {
    super(type || lhs.type, sourceSpan);
    this.operator = operator;
    this.rhs = rhs;
    this.parens = parens;
    this.lhs = lhs;
  }
  isEquivalent(e) {
    return e instanceof BinaryOperatorExpr && this.operator === e.operator && this.lhs.isEquivalent(e.lhs) && this.rhs.isEquivalent(e.rhs);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitBinaryOperatorExpr(this, context);
  }
  clone() {
    return new BinaryOperatorExpr(this.operator, this.lhs.clone(), this.rhs.clone(), this.type, this.sourceSpan, this.parens);
  }
}
class ReadPropExpr extends Expression {
  receiver;
  name;
  constructor(receiver, name, type, sourceSpan) {
    super(type, sourceSpan);
    this.receiver = receiver;
    this.name = name;
  }
  // An alias for name, which allows other logic to handle property reads and keyed reads together.
  get index() {
    return this.name;
  }
  isEquivalent(e) {
    return e instanceof ReadPropExpr && this.receiver.isEquivalent(e.receiver) && this.name === e.name;
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitReadPropExpr(this, context);
  }
  set(value) {
    return new WritePropExpr(this.receiver, this.name, value, null, this.sourceSpan);
  }
  clone() {
    return new ReadPropExpr(this.receiver.clone(), this.name, this.type, this.sourceSpan);
  }
}
class ReadKeyExpr extends Expression {
  receiver;
  index;
  constructor(receiver, index, type, sourceSpan) {
    super(type, sourceSpan);
    this.receiver = receiver;
    this.index = index;
  }
  isEquivalent(e) {
    return e instanceof ReadKeyExpr && this.receiver.isEquivalent(e.receiver) && this.index.isEquivalent(e.index);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitReadKeyExpr(this, context);
  }
  set(value) {
    return new WriteKeyExpr(this.receiver, this.index, value, null, this.sourceSpan);
  }
  clone() {
    return new ReadKeyExpr(this.receiver.clone(), this.index.clone(), this.type, this.sourceSpan);
  }
}
class LiteralArrayExpr extends Expression {
  entries;
  constructor(entries, type, sourceSpan) {
    super(type, sourceSpan);
    this.entries = entries;
  }
  isConstant() {
    return this.entries.every((e) => e.isConstant());
  }
  isEquivalent(e) {
    return e instanceof LiteralArrayExpr && areAllEquivalent(this.entries, e.entries);
  }
  visitExpression(visitor, context) {
    return visitor.visitLiteralArrayExpr(this, context);
  }
  clone() {
    return new LiteralArrayExpr(this.entries.map((e) => e.clone()), this.type, this.sourceSpan);
  }
}
class LiteralMapEntry {
  key;
  value;
  quoted;
  constructor(key, value, quoted) {
    this.key = key;
    this.value = value;
    this.quoted = quoted;
  }
  isEquivalent(e) {
    return this.key === e.key && this.value.isEquivalent(e.value);
  }
  clone() {
    return new LiteralMapEntry(this.key, this.value.clone(), this.quoted);
  }
}
class LiteralMapExpr extends Expression {
  entries;
  valueType = null;
  constructor(entries, type, sourceSpan) {
    super(type, sourceSpan);
    this.entries = entries;
    if (type) {
      this.valueType = type.valueType;
    }
  }
  isEquivalent(e) {
    return e instanceof LiteralMapExpr && areAllEquivalent(this.entries, e.entries);
  }
  isConstant() {
    return this.entries.every((e) => e.value.isConstant());
  }
  visitExpression(visitor, context) {
    return visitor.visitLiteralMapExpr(this, context);
  }
  clone() {
    const entriesClone = this.entries.map((entry) => entry.clone());
    return new LiteralMapExpr(entriesClone, this.type, this.sourceSpan);
  }
}
class CommaExpr extends Expression {
  parts;
  constructor(parts, sourceSpan) {
    super(parts[parts.length - 1].type, sourceSpan);
    this.parts = parts;
  }
  isEquivalent(e) {
    return e instanceof CommaExpr && areAllEquivalent(this.parts, e.parts);
  }
  isConstant() {
    return false;
  }
  visitExpression(visitor, context) {
    return visitor.visitCommaExpr(this, context);
  }
  clone() {
    return new CommaExpr(this.parts.map((p) => p.clone()));
  }
}
const NULL_EXPR = new LiteralExpr(null, null, null);
const TYPED_NULL_EXPR = new LiteralExpr(null, INFERRED_TYPE, null);
var StmtModifier;
(function(StmtModifier2) {
  StmtModifier2[StmtModifier2["None"] = 0] = "None";
  StmtModifier2[StmtModifier2["Final"] = 1] = "Final";
  StmtModifier2[StmtModifier2["Private"] = 2] = "Private";
  StmtModifier2[StmtModifier2["Exported"] = 4] = "Exported";
  StmtModifier2[StmtModifier2["Static"] = 8] = "Static";
})(StmtModifier || (StmtModifier = {}));
class LeadingComment {
  text;
  multiline;
  trailingNewline;
  constructor(text2, multiline, trailingNewline) {
    this.text = text2;
    this.multiline = multiline;
    this.trailingNewline = trailingNewline;
  }
  toString() {
    return this.multiline ? ` ${this.text} ` : this.text;
  }
}
class JSDocComment extends LeadingComment {
  tags;
  constructor(tags) {
    super(
      "",
      /* multiline */
      true,
      /* trailingNewline */
      true
    );
    this.tags = tags;
  }
  toString() {
    return serializeTags(this.tags);
  }
}
class Statement {
  modifiers;
  sourceSpan;
  leadingComments;
  constructor(modifiers = StmtModifier.None, sourceSpan = null, leadingComments) {
    this.modifiers = modifiers;
    this.sourceSpan = sourceSpan;
    this.leadingComments = leadingComments;
  }
  hasModifier(modifier) {
    return (this.modifiers & modifier) !== 0;
  }
  addLeadingComment(leadingComment2) {
    this.leadingComments = this.leadingComments ?? [];
    this.leadingComments.push(leadingComment2);
  }
}
class DeclareVarStmt extends Statement {
  name;
  value;
  type;
  constructor(name, value, type, modifiers, sourceSpan, leadingComments) {
    super(modifiers, sourceSpan, leadingComments);
    this.name = name;
    this.value = value;
    this.type = type || value && value.type || null;
  }
  isEquivalent(stmt) {
    return stmt instanceof DeclareVarStmt && this.name === stmt.name && (this.value ? !!stmt.value && this.value.isEquivalent(stmt.value) : !stmt.value);
  }
  visitStatement(visitor, context) {
    return visitor.visitDeclareVarStmt(this, context);
  }
}
class DeclareFunctionStmt extends Statement {
  name;
  params;
  statements;
  type;
  constructor(name, params, statements, type, modifiers, sourceSpan, leadingComments) {
    super(modifiers, sourceSpan, leadingComments);
    this.name = name;
    this.params = params;
    this.statements = statements;
    this.type = type || null;
  }
  isEquivalent(stmt) {
    return stmt instanceof DeclareFunctionStmt && areAllEquivalent(this.params, stmt.params) && areAllEquivalent(this.statements, stmt.statements);
  }
  visitStatement(visitor, context) {
    return visitor.visitDeclareFunctionStmt(this, context);
  }
}
class ExpressionStatement extends Statement {
  expr;
  constructor(expr, sourceSpan, leadingComments) {
    super(StmtModifier.None, sourceSpan, leadingComments);
    this.expr = expr;
  }
  isEquivalent(stmt) {
    return stmt instanceof ExpressionStatement && this.expr.isEquivalent(stmt.expr);
  }
  visitStatement(visitor, context) {
    return visitor.visitExpressionStmt(this, context);
  }
}
class ReturnStatement extends Statement {
  value;
  constructor(value, sourceSpan = null, leadingComments) {
    super(StmtModifier.None, sourceSpan, leadingComments);
    this.value = value;
  }
  isEquivalent(stmt) {
    return stmt instanceof ReturnStatement && this.value.isEquivalent(stmt.value);
  }
  visitStatement(visitor, context) {
    return visitor.visitReturnStmt(this, context);
  }
}
class IfStmt extends Statement {
  condition;
  trueCase;
  falseCase;
  constructor(condition, trueCase, falseCase = [], sourceSpan, leadingComments) {
    super(StmtModifier.None, sourceSpan, leadingComments);
    this.condition = condition;
    this.trueCase = trueCase;
    this.falseCase = falseCase;
  }
  isEquivalent(stmt) {
    return stmt instanceof IfStmt && this.condition.isEquivalent(stmt.condition) && areAllEquivalent(this.trueCase, stmt.trueCase) && areAllEquivalent(this.falseCase, stmt.falseCase);
  }
  visitStatement(visitor, context) {
    return visitor.visitIfStmt(this, context);
  }
}
class RecursiveAstVisitor$1 {
  visitType(ast, context) {
    return ast;
  }
  visitExpression(ast, context) {
    if (ast.type) {
      ast.type.visitType(this, context);
    }
    return ast;
  }
  visitBuiltinType(type, context) {
    return this.visitType(type, context);
  }
  visitExpressionType(type, context) {
    type.value.visitExpression(this, context);
    if (type.typeParams !== null) {
      type.typeParams.forEach((param) => this.visitType(param, context));
    }
    return this.visitType(type, context);
  }
  visitArrayType(type, context) {
    return this.visitType(type, context);
  }
  visitMapType(type, context) {
    return this.visitType(type, context);
  }
  visitTransplantedType(type, context) {
    return type;
  }
  visitWrappedNodeExpr(ast, context) {
    return ast;
  }
  visitTypeofExpr(ast, context) {
    return this.visitExpression(ast, context);
  }
  visitReadVarExpr(ast, context) {
    return this.visitExpression(ast, context);
  }
  visitWriteVarExpr(ast, context) {
    ast.value.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitWriteKeyExpr(ast, context) {
    ast.receiver.visitExpression(this, context);
    ast.index.visitExpression(this, context);
    ast.value.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitWritePropExpr(ast, context) {
    ast.receiver.visitExpression(this, context);
    ast.value.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitDynamicImportExpr(ast, context) {
    return this.visitExpression(ast, context);
  }
  visitInvokeFunctionExpr(ast, context) {
    ast.fn.visitExpression(this, context);
    this.visitAllExpressions(ast.args, context);
    return this.visitExpression(ast, context);
  }
  visitTaggedTemplateExpr(ast, context) {
    ast.tag.visitExpression(this, context);
    this.visitAllExpressions(ast.template.expressions, context);
    return this.visitExpression(ast, context);
  }
  visitInstantiateExpr(ast, context) {
    ast.classExpr.visitExpression(this, context);
    this.visitAllExpressions(ast.args, context);
    return this.visitExpression(ast, context);
  }
  visitLiteralExpr(ast, context) {
    return this.visitExpression(ast, context);
  }
  visitLocalizedString(ast, context) {
    return this.visitExpression(ast, context);
  }
  visitExternalExpr(ast, context) {
    if (ast.typeParams) {
      ast.typeParams.forEach((type) => type.visitType(this, context));
    }
    return this.visitExpression(ast, context);
  }
  visitConditionalExpr(ast, context) {
    ast.condition.visitExpression(this, context);
    ast.trueCase.visitExpression(this, context);
    ast.falseCase.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitNotExpr(ast, context) {
    ast.condition.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitFunctionExpr(ast, context) {
    this.visitAllStatements(ast.statements, context);
    return this.visitExpression(ast, context);
  }
  visitArrowFunctionExpr(ast, context) {
    if (Array.isArray(ast.body)) {
      this.visitAllStatements(ast.body, context);
    } else {
      ast.body.visitExpression(this, context);
    }
    return this.visitExpression(ast, context);
  }
  visitUnaryOperatorExpr(ast, context) {
    ast.expr.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitBinaryOperatorExpr(ast, context) {
    ast.lhs.visitExpression(this, context);
    ast.rhs.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitReadPropExpr(ast, context) {
    ast.receiver.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitReadKeyExpr(ast, context) {
    ast.receiver.visitExpression(this, context);
    ast.index.visitExpression(this, context);
    return this.visitExpression(ast, context);
  }
  visitLiteralArrayExpr(ast, context) {
    this.visitAllExpressions(ast.entries, context);
    return this.visitExpression(ast, context);
  }
  visitLiteralMapExpr(ast, context) {
    ast.entries.forEach((entry) => entry.value.visitExpression(this, context));
    return this.visitExpression(ast, context);
  }
  visitCommaExpr(ast, context) {
    this.visitAllExpressions(ast.parts, context);
    return this.visitExpression(ast, context);
  }
  visitAllExpressions(exprs, context) {
    exprs.forEach((expr) => expr.visitExpression(this, context));
  }
  visitDeclareVarStmt(stmt, context) {
    if (stmt.value) {
      stmt.value.visitExpression(this, context);
    }
    if (stmt.type) {
      stmt.type.visitType(this, context);
    }
    return stmt;
  }
  visitDeclareFunctionStmt(stmt, context) {
    this.visitAllStatements(stmt.statements, context);
    if (stmt.type) {
      stmt.type.visitType(this, context);
    }
    return stmt;
  }
  visitExpressionStmt(stmt, context) {
    stmt.expr.visitExpression(this, context);
    return stmt;
  }
  visitReturnStmt(stmt, context) {
    stmt.value.visitExpression(this, context);
    return stmt;
  }
  visitIfStmt(stmt, context) {
    stmt.condition.visitExpression(this, context);
    this.visitAllStatements(stmt.trueCase, context);
    this.visitAllStatements(stmt.falseCase, context);
    return stmt;
  }
  visitAllStatements(stmts, context) {
    stmts.forEach((stmt) => stmt.visitStatement(this, context));
  }
}
function leadingComment(text2, multiline = false, trailingNewline = true) {
  return new LeadingComment(text2, multiline, trailingNewline);
}
function jsDocComment(tags = []) {
  return new JSDocComment(tags);
}
function variable(name, type, sourceSpan) {
  return new ReadVarExpr(name, type, sourceSpan);
}
function importExpr(id, typeParams = null, sourceSpan) {
  return new ExternalExpr(id, null, typeParams, sourceSpan);
}
function importType(id, typeParams, typeModifiers) {
  return id != null ? expressionType(importExpr(id, typeParams, null), typeModifiers) : null;
}
function expressionType(expr, typeModifiers, typeParams) {
  return new ExpressionType(expr, typeModifiers, typeParams);
}
function transplantedType(type, typeModifiers) {
  return new TransplantedType(type, typeModifiers);
}
function typeofExpr(expr) {
  return new TypeofExpr(expr);
}
function literalArr(values, type, sourceSpan) {
  return new LiteralArrayExpr(values, type, sourceSpan);
}
function literalMap(values, type = null) {
  return new LiteralMapExpr(values.map((e) => new LiteralMapEntry(e.key, e.value, e.quoted)), type, null);
}
function unary(operator, expr, type, sourceSpan) {
  return new UnaryOperatorExpr(operator, expr, type, sourceSpan);
}
function not(expr, sourceSpan) {
  return new NotExpr(expr, sourceSpan);
}
function fn(params, body, type, sourceSpan, name) {
  return new FunctionExpr(params, body, type, sourceSpan, name);
}
function arrowFn(params, body, type, sourceSpan) {
  return new ArrowFunctionExpr(params, body, type, sourceSpan);
}
function ifStmt(condition, thenClause, elseClause, sourceSpan, leadingComments) {
  return new IfStmt(condition, thenClause, elseClause, sourceSpan, leadingComments);
}
function taggedTemplate(tag, template2, type, sourceSpan) {
  return new TaggedTemplateExpr(tag, template2, type, sourceSpan);
}
function literal(value, type, sourceSpan) {
  return new LiteralExpr(value, type, sourceSpan);
}
function localizedString(metaBlock, messageParts, placeholderNames, expressions, sourceSpan) {
  return new LocalizedString(metaBlock, messageParts, placeholderNames, expressions, sourceSpan);
}
function isNull(exp) {
  return exp instanceof LiteralExpr && exp.value === null;
}
function tagToString(tag) {
  let out = "";
  if (tag.tagName) {
    out += ` @${tag.tagName}`;
  }
  if (tag.text) {
    if (tag.text.match(/\/\*|\*\//)) {
      throw new Error('JSDoc text cannot contain "/*" and "*/"');
    }
    out += " " + tag.text.replace(/@/g, "\\@");
  }
  return out;
}
function serializeTags(tags) {
  if (tags.length === 0)
    return "";
  if (tags.length === 1 && tags[0].tagName && !tags[0].text) {
    return `*${tagToString(tags[0])} `;
  }
  let out = "*\n";
  for (const tag of tags) {
    out += " *";
    out += tagToString(tag).replace(/\n/g, "\n * ");
    out += "\n";
  }
  out += " ";
  return out;
}
var output_ast = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  get TypeModifier() {
    return TypeModifier;
  },
  Type,
  get BuiltinTypeName() {
    return BuiltinTypeName;
  },
  BuiltinType,
  ExpressionType,
  ArrayType,
  MapType,
  TransplantedType,
  DYNAMIC_TYPE,
  INFERRED_TYPE,
  BOOL_TYPE,
  INT_TYPE,
  NUMBER_TYPE,
  STRING_TYPE,
  FUNCTION_TYPE,
  NONE_TYPE,
  get UnaryOperator() {
    return UnaryOperator;
  },
  get BinaryOperator() {
    return BinaryOperator;
  },
  nullSafeIsEquivalent,
  areAllEquivalent,
  Expression,
  ReadVarExpr,
  TypeofExpr,
  WrappedNodeExpr,
  WriteVarExpr,
  WriteKeyExpr,
  WritePropExpr,
  InvokeFunctionExpr,
  TaggedTemplateExpr,
  InstantiateExpr,
  LiteralExpr,
  TemplateLiteral,
  TemplateLiteralElement,
  LiteralPiece,
  PlaceholderPiece,
  LocalizedString,
  ExternalExpr,
  ExternalReference,
  ConditionalExpr,
  DynamicImportExpr,
  NotExpr,
  FnParam,
  FunctionExpr,
  ArrowFunctionExpr,
  UnaryOperatorExpr,
  BinaryOperatorExpr,
  ReadPropExpr,
  ReadKeyExpr,
  LiteralArrayExpr,
  LiteralMapEntry,
  LiteralMapExpr,
  CommaExpr,
  NULL_EXPR,
  TYPED_NULL_EXPR,
  get StmtModifier() {
    return StmtModifier;
  },
  LeadingComment,
  JSDocComment,
  Statement,
  DeclareVarStmt,
  DeclareFunctionStmt,
  ExpressionStatement,
  ReturnStatement,
  IfStmt,
  RecursiveAstVisitor: RecursiveAstVisitor$1,
  leadingComment,
  jsDocComment,
  variable,
  importExpr,
  importType,
  expressionType,
  transplantedType,
  typeofExpr,
  literalArr,
  literalMap,
  unary,
  not,
  fn,
  arrowFn,
  ifStmt,
  taggedTemplate,
  literal,
  localizedString,
  isNull
});
const CONSTANT_PREFIX = "_c";
const UNKNOWN_VALUE_KEY = variable("<unknown>");
const KEY_CONTEXT = {};
const POOL_INCLUSION_LENGTH_THRESHOLD_FOR_STRINGS = 50;
class FixupExpression extends Expression {
  resolved;
  original;
  shared = false;
  constructor(resolved) {
    super(resolved.type);
    this.resolved = resolved;
    this.original = resolved;
  }
  visitExpression(visitor, context) {
    if (context === KEY_CONTEXT) {
      return this.original.visitExpression(visitor, context);
    } else {
      return this.resolved.visitExpression(visitor, context);
    }
  }
  isEquivalent(e) {
    return e instanceof FixupExpression && this.resolved.isEquivalent(e.resolved);
  }
  isConstant() {
    return true;
  }
  clone() {
    throw new Error(`Not supported.`);
  }
  fixup(expression) {
    this.resolved = expression;
    this.shared = true;
  }
}
class ConstantPool {
  isClosureCompilerEnabled;
  statements = [];
  literals = /* @__PURE__ */ new Map();
  literalFactories = /* @__PURE__ */ new Map();
  sharedConstants = /* @__PURE__ */ new Map();
  /**
   * Constant pool also tracks claimed names from {@link uniqueName}.
   * This is useful to avoid collisions if variables are intended to be
   * named a certain way- but may conflict. We wouldn't want to always suffix
   * them with unique numbers.
   */
  _claimedNames = /* @__PURE__ */ new Map();
  nextNameIndex = 0;
  constructor(isClosureCompilerEnabled = false) {
    this.isClosureCompilerEnabled = isClosureCompilerEnabled;
  }
  getConstLiteral(literal2, forceShared) {
    if (literal2 instanceof LiteralExpr && !isLongStringLiteral(literal2) || literal2 instanceof FixupExpression) {
      return literal2;
    }
    const key = GenericKeyFn.INSTANCE.keyOf(literal2);
    let fixup = this.literals.get(key);
    let newValue = false;
    if (!fixup) {
      fixup = new FixupExpression(literal2);
      this.literals.set(key, fixup);
      newValue = true;
    }
    if (!newValue && !fixup.shared || newValue && forceShared) {
      const name = this.freshName();
      let definition;
      let usage;
      if (this.isClosureCompilerEnabled && isLongStringLiteral(literal2)) {
        definition = variable(name).set(new FunctionExpr(
          [],
          // Params.
          [
            // Statements.
            new ReturnStatement(literal2)
          ]
        ));
        usage = variable(name).callFn([]);
      } else {
        definition = variable(name).set(literal2);
        usage = variable(name);
      }
      this.statements.push(definition.toDeclStmt(INFERRED_TYPE, StmtModifier.Final));
      fixup.fixup(usage);
    }
    return fixup;
  }
  getSharedConstant(def, expr) {
    const key = def.keyOf(expr);
    if (!this.sharedConstants.has(key)) {
      const id = this.freshName();
      this.sharedConstants.set(key, variable(id));
      this.statements.push(def.toSharedConstantDeclaration(id, expr));
    }
    return this.sharedConstants.get(key);
  }
  getLiteralFactory(literal2) {
    if (literal2 instanceof LiteralArrayExpr) {
      const argumentsForKey = literal2.entries.map((e) => e.isConstant() ? e : UNKNOWN_VALUE_KEY);
      const key = GenericKeyFn.INSTANCE.keyOf(literalArr(argumentsForKey));
      return this._getLiteralFactory(key, literal2.entries, (entries) => literalArr(entries));
    } else {
      const expressionForKey = literalMap(literal2.entries.map((e) => ({
        key: e.key,
        value: e.value.isConstant() ? e.value : UNKNOWN_VALUE_KEY,
        quoted: e.quoted
      })));
      const key = GenericKeyFn.INSTANCE.keyOf(expressionForKey);
      return this._getLiteralFactory(key, literal2.entries.map((e) => e.value), (entries) => literalMap(entries.map((value, index) => ({
        key: literal2.entries[index].key,
        value,
        quoted: literal2.entries[index].quoted
      }))));
    }
  }
  // TODO: useUniqueName(false) is necessary for naming compatibility with
  // TemplateDefinitionBuilder, but should be removed once Template Pipeline is the default.
  getSharedFunctionReference(fn2, prefix, useUniqueName = true) {
    const isArrow = fn2 instanceof ArrowFunctionExpr;
    for (const current of this.statements) {
      if (isArrow && current instanceof DeclareVarStmt && current.value?.isEquivalent(fn2)) {
        return variable(current.name);
      }
      if (!isArrow && current instanceof DeclareFunctionStmt && fn2 instanceof FunctionExpr && fn2.isEquivalent(current)) {
        return variable(current.name);
      }
    }
    const name = useUniqueName ? this.uniqueName(prefix) : prefix;
    this.statements.push(fn2 instanceof FunctionExpr ? fn2.toDeclStmt(name, StmtModifier.Final) : new DeclareVarStmt(name, fn2, INFERRED_TYPE, StmtModifier.Final, fn2.sourceSpan));
    return variable(name);
  }
  _getLiteralFactory(key, values, resultMap) {
    let literalFactory = this.literalFactories.get(key);
    const literalFactoryArguments = values.filter((e) => !e.isConstant());
    if (!literalFactory) {
      const resultExpressions = values.map((e, index) => e.isConstant() ? this.getConstLiteral(e, true) : variable(`a${index}`));
      const parameters = resultExpressions.filter(isVariable).map((e) => new FnParam(e.name, DYNAMIC_TYPE));
      const pureFunctionDeclaration = arrowFn(parameters, resultMap(resultExpressions), INFERRED_TYPE);
      const name = this.freshName();
      this.statements.push(variable(name).set(pureFunctionDeclaration).toDeclStmt(INFERRED_TYPE, StmtModifier.Final));
      literalFactory = variable(name);
      this.literalFactories.set(key, literalFactory);
    }
    return { literalFactory, literalFactoryArguments };
  }
  /**
   * Produce a unique name in the context of this pool.
   *
   * The name might be unique among different prefixes if any of the prefixes end in
   * a digit so the prefix should be a constant string (not based on user input) and
   * must not end in a digit.
   */
  uniqueName(name, alwaysIncludeSuffix = true) {
    const count = this._claimedNames.get(name) ?? 0;
    const result = count === 0 && !alwaysIncludeSuffix ? `${name}` : `${name}${count}`;
    this._claimedNames.set(name, count + 1);
    return result;
  }
  freshName() {
    return this.uniqueName(CONSTANT_PREFIX);
  }
}
class GenericKeyFn {
  static INSTANCE = new GenericKeyFn();
  keyOf(expr) {
    if (expr instanceof LiteralExpr && typeof expr.value === "string") {
      return `"${expr.value}"`;
    } else if (expr instanceof LiteralExpr) {
      return String(expr.value);
    } else if (expr instanceof LiteralArrayExpr) {
      const entries = [];
      for (const entry of expr.entries) {
        entries.push(this.keyOf(entry));
      }
      return `[${entries.join(",")}]`;
    } else if (expr instanceof LiteralMapExpr) {
      const entries = [];
      for (const entry of expr.entries) {
        let key = entry.key;
        if (entry.quoted) {
          key = `"${key}"`;
        }
        entries.push(key + ":" + this.keyOf(entry.value));
      }
      return `{${entries.join(",")}}`;
    } else if (expr instanceof ExternalExpr) {
      return `import("${expr.value.moduleName}", ${expr.value.name})`;
    } else if (expr instanceof ReadVarExpr) {
      return `read(${expr.name})`;
    } else if (expr instanceof TypeofExpr) {
      return `typeof(${this.keyOf(expr.expr)})`;
    } else {
      throw new Error(`${this.constructor.name} does not handle expressions of type ${expr.constructor.name}`);
    }
  }
}
function isVariable(e) {
  return e instanceof ReadVarExpr;
}
function isLongStringLiteral(expr) {
  return expr instanceof LiteralExpr && typeof expr.value === "string" && expr.value.length >= POOL_INCLUSION_LENGTH_THRESHOLD_FOR_STRINGS;
}
const CORE = "@angular/core";
class Identifiers {
  /* Methods */
  static NEW_METHOD = "factory";
  static TRANSFORM_METHOD = "transform";
  static PATCH_DEPS = "patchedDeps";
  static core = { name: null, moduleName: CORE };
  /* Instructions */
  static namespaceHTML = { name: "ɵɵnamespaceHTML", moduleName: CORE };
  static namespaceMathML = { name: "ɵɵnamespaceMathML", moduleName: CORE };
  static namespaceSVG = { name: "ɵɵnamespaceSVG", moduleName: CORE };
  static element = { name: "ɵɵelement", moduleName: CORE };
  static elementStart = { name: "ɵɵelementStart", moduleName: CORE };
  static elementEnd = { name: "ɵɵelementEnd", moduleName: CORE };
  static advance = { name: "ɵɵadvance", moduleName: CORE };
  static syntheticHostProperty = {
    name: "ɵɵsyntheticHostProperty",
    moduleName: CORE
  };
  static syntheticHostListener = {
    name: "ɵɵsyntheticHostListener",
    moduleName: CORE
  };
  static attribute = { name: "ɵɵattribute", moduleName: CORE };
  static attributeInterpolate1 = {
    name: "ɵɵattributeInterpolate1",
    moduleName: CORE
  };
  static attributeInterpolate2 = {
    name: "ɵɵattributeInterpolate2",
    moduleName: CORE
  };
  static attributeInterpolate3 = {
    name: "ɵɵattributeInterpolate3",
    moduleName: CORE
  };
  static attributeInterpolate4 = {
    name: "ɵɵattributeInterpolate4",
    moduleName: CORE
  };
  static attributeInterpolate5 = {
    name: "ɵɵattributeInterpolate5",
    moduleName: CORE
  };
  static attributeInterpolate6 = {
    name: "ɵɵattributeInterpolate6",
    moduleName: CORE
  };
  static attributeInterpolate7 = {
    name: "ɵɵattributeInterpolate7",
    moduleName: CORE
  };
  static attributeInterpolate8 = {
    name: "ɵɵattributeInterpolate8",
    moduleName: CORE
  };
  static attributeInterpolateV = {
    name: "ɵɵattributeInterpolateV",
    moduleName: CORE
  };
  static classProp = { name: "ɵɵclassProp", moduleName: CORE };
  static elementContainerStart = {
    name: "ɵɵelementContainerStart",
    moduleName: CORE
  };
  static elementContainerEnd = {
    name: "ɵɵelementContainerEnd",
    moduleName: CORE
  };
  static elementContainer = { name: "ɵɵelementContainer", moduleName: CORE };
  static styleMap = { name: "ɵɵstyleMap", moduleName: CORE };
  static styleMapInterpolate1 = {
    name: "ɵɵstyleMapInterpolate1",
    moduleName: CORE
  };
  static styleMapInterpolate2 = {
    name: "ɵɵstyleMapInterpolate2",
    moduleName: CORE
  };
  static styleMapInterpolate3 = {
    name: "ɵɵstyleMapInterpolate3",
    moduleName: CORE
  };
  static styleMapInterpolate4 = {
    name: "ɵɵstyleMapInterpolate4",
    moduleName: CORE
  };
  static styleMapInterpolate5 = {
    name: "ɵɵstyleMapInterpolate5",
    moduleName: CORE
  };
  static styleMapInterpolate6 = {
    name: "ɵɵstyleMapInterpolate6",
    moduleName: CORE
  };
  static styleMapInterpolate7 = {
    name: "ɵɵstyleMapInterpolate7",
    moduleName: CORE
  };
  static styleMapInterpolate8 = {
    name: "ɵɵstyleMapInterpolate8",
    moduleName: CORE
  };
  static styleMapInterpolateV = {
    name: "ɵɵstyleMapInterpolateV",
    moduleName: CORE
  };
  static classMap = { name: "ɵɵclassMap", moduleName: CORE };
  static classMapInterpolate1 = {
    name: "ɵɵclassMapInterpolate1",
    moduleName: CORE
  };
  static classMapInterpolate2 = {
    name: "ɵɵclassMapInterpolate2",
    moduleName: CORE
  };
  static classMapInterpolate3 = {
    name: "ɵɵclassMapInterpolate3",
    moduleName: CORE
  };
  static classMapInterpolate4 = {
    name: "ɵɵclassMapInterpolate4",
    moduleName: CORE
  };
  static classMapInterpolate5 = {
    name: "ɵɵclassMapInterpolate5",
    moduleName: CORE
  };
  static classMapInterpolate6 = {
    name: "ɵɵclassMapInterpolate6",
    moduleName: CORE
  };
  static classMapInterpolate7 = {
    name: "ɵɵclassMapInterpolate7",
    moduleName: CORE
  };
  static classMapInterpolate8 = {
    name: "ɵɵclassMapInterpolate8",
    moduleName: CORE
  };
  static classMapInterpolateV = {
    name: "ɵɵclassMapInterpolateV",
    moduleName: CORE
  };
  static styleProp = { name: "ɵɵstyleProp", moduleName: CORE };
  static stylePropInterpolate1 = {
    name: "ɵɵstylePropInterpolate1",
    moduleName: CORE
  };
  static stylePropInterpolate2 = {
    name: "ɵɵstylePropInterpolate2",
    moduleName: CORE
  };
  static stylePropInterpolate3 = {
    name: "ɵɵstylePropInterpolate3",
    moduleName: CORE
  };
  static stylePropInterpolate4 = {
    name: "ɵɵstylePropInterpolate4",
    moduleName: CORE
  };
  static stylePropInterpolate5 = {
    name: "ɵɵstylePropInterpolate5",
    moduleName: CORE
  };
  static stylePropInterpolate6 = {
    name: "ɵɵstylePropInterpolate6",
    moduleName: CORE
  };
  static stylePropInterpolate7 = {
    name: "ɵɵstylePropInterpolate7",
    moduleName: CORE
  };
  static stylePropInterpolate8 = {
    name: "ɵɵstylePropInterpolate8",
    moduleName: CORE
  };
  static stylePropInterpolateV = {
    name: "ɵɵstylePropInterpolateV",
    moduleName: CORE
  };
  static nextContext = { name: "ɵɵnextContext", moduleName: CORE };
  static resetView = { name: "ɵɵresetView", moduleName: CORE };
  static templateCreate = { name: "ɵɵtemplate", moduleName: CORE };
  static defer = { name: "ɵɵdefer", moduleName: CORE };
  static deferWhen = { name: "ɵɵdeferWhen", moduleName: CORE };
  static deferOnIdle = { name: "ɵɵdeferOnIdle", moduleName: CORE };
  static deferOnImmediate = { name: "ɵɵdeferOnImmediate", moduleName: CORE };
  static deferOnTimer = { name: "ɵɵdeferOnTimer", moduleName: CORE };
  static deferOnHover = { name: "ɵɵdeferOnHover", moduleName: CORE };
  static deferOnInteraction = { name: "ɵɵdeferOnInteraction", moduleName: CORE };
  static deferOnViewport = { name: "ɵɵdeferOnViewport", moduleName: CORE };
  static deferPrefetchWhen = { name: "ɵɵdeferPrefetchWhen", moduleName: CORE };
  static deferPrefetchOnIdle = {
    name: "ɵɵdeferPrefetchOnIdle",
    moduleName: CORE
  };
  static deferPrefetchOnImmediate = {
    name: "ɵɵdeferPrefetchOnImmediate",
    moduleName: CORE
  };
  static deferPrefetchOnTimer = {
    name: "ɵɵdeferPrefetchOnTimer",
    moduleName: CORE
  };
  static deferPrefetchOnHover = {
    name: "ɵɵdeferPrefetchOnHover",
    moduleName: CORE
  };
  static deferPrefetchOnInteraction = {
    name: "ɵɵdeferPrefetchOnInteraction",
    moduleName: CORE
  };
  static deferPrefetchOnViewport = {
    name: "ɵɵdeferPrefetchOnViewport",
    moduleName: CORE
  };
  static deferHydrateWhen = { name: "ɵɵdeferHydrateWhen", moduleName: CORE };
  static deferHydrateNever = { name: "ɵɵdeferHydrateNever", moduleName: CORE };
  static deferHydrateOnIdle = {
    name: "ɵɵdeferHydrateOnIdle",
    moduleName: CORE
  };
  static deferHydrateOnImmediate = {
    name: "ɵɵdeferHydrateOnImmediate",
    moduleName: CORE
  };
  static deferHydrateOnTimer = {
    name: "ɵɵdeferHydrateOnTimer",
    moduleName: CORE
  };
  static deferHydrateOnHover = {
    name: "ɵɵdeferHydrateOnHover",
    moduleName: CORE
  };
  static deferHydrateOnInteraction = {
    name: "ɵɵdeferHydrateOnInteraction",
    moduleName: CORE
  };
  static deferHydrateOnViewport = {
    name: "ɵɵdeferHydrateOnViewport",
    moduleName: CORE
  };
  static deferEnableTimerScheduling = {
    name: "ɵɵdeferEnableTimerScheduling",
    moduleName: CORE
  };
  static conditional = { name: "ɵɵconditional", moduleName: CORE };
  static repeater = { name: "ɵɵrepeater", moduleName: CORE };
  static repeaterCreate = { name: "ɵɵrepeaterCreate", moduleName: CORE };
  static repeaterTrackByIndex = {
    name: "ɵɵrepeaterTrackByIndex",
    moduleName: CORE
  };
  static repeaterTrackByIdentity = {
    name: "ɵɵrepeaterTrackByIdentity",
    moduleName: CORE
  };
  static componentInstance = { name: "ɵɵcomponentInstance", moduleName: CORE };
  static text = { name: "ɵɵtext", moduleName: CORE };
  static enableBindings = { name: "ɵɵenableBindings", moduleName: CORE };
  static disableBindings = { name: "ɵɵdisableBindings", moduleName: CORE };
  static getCurrentView = { name: "ɵɵgetCurrentView", moduleName: CORE };
  static textInterpolate = { name: "ɵɵtextInterpolate", moduleName: CORE };
  static textInterpolate1 = { name: "ɵɵtextInterpolate1", moduleName: CORE };
  static textInterpolate2 = { name: "ɵɵtextInterpolate2", moduleName: CORE };
  static textInterpolate3 = { name: "ɵɵtextInterpolate3", moduleName: CORE };
  static textInterpolate4 = { name: "ɵɵtextInterpolate4", moduleName: CORE };
  static textInterpolate5 = { name: "ɵɵtextInterpolate5", moduleName: CORE };
  static textInterpolate6 = { name: "ɵɵtextInterpolate6", moduleName: CORE };
  static textInterpolate7 = { name: "ɵɵtextInterpolate7", moduleName: CORE };
  static textInterpolate8 = { name: "ɵɵtextInterpolate8", moduleName: CORE };
  static textInterpolateV = { name: "ɵɵtextInterpolateV", moduleName: CORE };
  static restoreView = { name: "ɵɵrestoreView", moduleName: CORE };
  static pureFunction0 = { name: "ɵɵpureFunction0", moduleName: CORE };
  static pureFunction1 = { name: "ɵɵpureFunction1", moduleName: CORE };
  static pureFunction2 = { name: "ɵɵpureFunction2", moduleName: CORE };
  static pureFunction3 = { name: "ɵɵpureFunction3", moduleName: CORE };
  static pureFunction4 = { name: "ɵɵpureFunction4", moduleName: CORE };
  static pureFunction5 = { name: "ɵɵpureFunction5", moduleName: CORE };
  static pureFunction6 = { name: "ɵɵpureFunction6", moduleName: CORE };
  static pureFunction7 = { name: "ɵɵpureFunction7", moduleName: CORE };
  static pureFunction8 = { name: "ɵɵpureFunction8", moduleName: CORE };
  static pureFunctionV = { name: "ɵɵpureFunctionV", moduleName: CORE };
  static pipeBind1 = { name: "ɵɵpipeBind1", moduleName: CORE };
  static pipeBind2 = { name: "ɵɵpipeBind2", moduleName: CORE };
  static pipeBind3 = { name: "ɵɵpipeBind3", moduleName: CORE };
  static pipeBind4 = { name: "ɵɵpipeBind4", moduleName: CORE };
  static pipeBindV = { name: "ɵɵpipeBindV", moduleName: CORE };
  static hostProperty = { name: "ɵɵhostProperty", moduleName: CORE };
  static property = { name: "ɵɵproperty", moduleName: CORE };
  static propertyInterpolate = {
    name: "ɵɵpropertyInterpolate",
    moduleName: CORE
  };
  static propertyInterpolate1 = {
    name: "ɵɵpropertyInterpolate1",
    moduleName: CORE
  };
  static propertyInterpolate2 = {
    name: "ɵɵpropertyInterpolate2",
    moduleName: CORE
  };
  static propertyInterpolate3 = {
    name: "ɵɵpropertyInterpolate3",
    moduleName: CORE
  };
  static propertyInterpolate4 = {
    name: "ɵɵpropertyInterpolate4",
    moduleName: CORE
  };
  static propertyInterpolate5 = {
    name: "ɵɵpropertyInterpolate5",
    moduleName: CORE
  };
  static propertyInterpolate6 = {
    name: "ɵɵpropertyInterpolate6",
    moduleName: CORE
  };
  static propertyInterpolate7 = {
    name: "ɵɵpropertyInterpolate7",
    moduleName: CORE
  };
  static propertyInterpolate8 = {
    name: "ɵɵpropertyInterpolate8",
    moduleName: CORE
  };
  static propertyInterpolateV = {
    name: "ɵɵpropertyInterpolateV",
    moduleName: CORE
  };
  static i18n = { name: "ɵɵi18n", moduleName: CORE };
  static i18nAttributes = { name: "ɵɵi18nAttributes", moduleName: CORE };
  static i18nExp = { name: "ɵɵi18nExp", moduleName: CORE };
  static i18nStart = { name: "ɵɵi18nStart", moduleName: CORE };
  static i18nEnd = { name: "ɵɵi18nEnd", moduleName: CORE };
  static i18nApply = { name: "ɵɵi18nApply", moduleName: CORE };
  static i18nPostprocess = { name: "ɵɵi18nPostprocess", moduleName: CORE };
  static pipe = { name: "ɵɵpipe", moduleName: CORE };
  static projection = { name: "ɵɵprojection", moduleName: CORE };
  static projectionDef = { name: "ɵɵprojectionDef", moduleName: CORE };
  static reference = { name: "ɵɵreference", moduleName: CORE };
  static inject = { name: "ɵɵinject", moduleName: CORE };
  static injectAttribute = { name: "ɵɵinjectAttribute", moduleName: CORE };
  static directiveInject = { name: "ɵɵdirectiveInject", moduleName: CORE };
  static invalidFactory = { name: "ɵɵinvalidFactory", moduleName: CORE };
  static invalidFactoryDep = { name: "ɵɵinvalidFactoryDep", moduleName: CORE };
  static templateRefExtractor = {
    name: "ɵɵtemplateRefExtractor",
    moduleName: CORE
  };
  static forwardRef = { name: "forwardRef", moduleName: CORE };
  static resolveForwardRef = { name: "resolveForwardRef", moduleName: CORE };
  static replaceMetadata = { name: "ɵɵreplaceMetadata", moduleName: CORE };
  static ɵɵdefineInjectable = { name: "ɵɵdefineInjectable", moduleName: CORE };
  static declareInjectable = { name: "ɵɵngDeclareInjectable", moduleName: CORE };
  static InjectableDeclaration = {
    name: "ɵɵInjectableDeclaration",
    moduleName: CORE
  };
  static resolveWindow = { name: "ɵɵresolveWindow", moduleName: CORE };
  static resolveDocument = { name: "ɵɵresolveDocument", moduleName: CORE };
  static resolveBody = { name: "ɵɵresolveBody", moduleName: CORE };
  static getComponentDepsFactory = {
    name: "ɵɵgetComponentDepsFactory",
    moduleName: CORE
  };
  static defineComponent = { name: "ɵɵdefineComponent", moduleName: CORE };
  static declareComponent = { name: "ɵɵngDeclareComponent", moduleName: CORE };
  static setComponentScope = { name: "ɵɵsetComponentScope", moduleName: CORE };
  static ChangeDetectionStrategy = {
    name: "ChangeDetectionStrategy",
    moduleName: CORE
  };
  static ViewEncapsulation = {
    name: "ViewEncapsulation",
    moduleName: CORE
  };
  static ComponentDeclaration = {
    name: "ɵɵComponentDeclaration",
    moduleName: CORE
  };
  static FactoryDeclaration = {
    name: "ɵɵFactoryDeclaration",
    moduleName: CORE
  };
  static declareFactory = { name: "ɵɵngDeclareFactory", moduleName: CORE };
  static FactoryTarget = { name: "ɵɵFactoryTarget", moduleName: CORE };
  static defineDirective = { name: "ɵɵdefineDirective", moduleName: CORE };
  static declareDirective = { name: "ɵɵngDeclareDirective", moduleName: CORE };
  static DirectiveDeclaration = {
    name: "ɵɵDirectiveDeclaration",
    moduleName: CORE
  };
  static InjectorDef = { name: "ɵɵInjectorDef", moduleName: CORE };
  static InjectorDeclaration = {
    name: "ɵɵInjectorDeclaration",
    moduleName: CORE
  };
  static defineInjector = { name: "ɵɵdefineInjector", moduleName: CORE };
  static declareInjector = { name: "ɵɵngDeclareInjector", moduleName: CORE };
  static NgModuleDeclaration = {
    name: "ɵɵNgModuleDeclaration",
    moduleName: CORE
  };
  static ModuleWithProviders = {
    name: "ModuleWithProviders",
    moduleName: CORE
  };
  static defineNgModule = { name: "ɵɵdefineNgModule", moduleName: CORE };
  static declareNgModule = { name: "ɵɵngDeclareNgModule", moduleName: CORE };
  static setNgModuleScope = { name: "ɵɵsetNgModuleScope", moduleName: CORE };
  static registerNgModuleType = {
    name: "ɵɵregisterNgModuleType",
    moduleName: CORE
  };
  static PipeDeclaration = { name: "ɵɵPipeDeclaration", moduleName: CORE };
  static definePipe = { name: "ɵɵdefinePipe", moduleName: CORE };
  static declarePipe = { name: "ɵɵngDeclarePipe", moduleName: CORE };
  static declareClassMetadata = {
    name: "ɵɵngDeclareClassMetadata",
    moduleName: CORE
  };
  static declareClassMetadataAsync = {
    name: "ɵɵngDeclareClassMetadataAsync",
    moduleName: CORE
  };
  static setClassMetadata = { name: "ɵsetClassMetadata", moduleName: CORE };
  static setClassMetadataAsync = {
    name: "ɵsetClassMetadataAsync",
    moduleName: CORE
  };
  static setClassDebugInfo = { name: "ɵsetClassDebugInfo", moduleName: CORE };
  static queryRefresh = { name: "ɵɵqueryRefresh", moduleName: CORE };
  static viewQuery = { name: "ɵɵviewQuery", moduleName: CORE };
  static loadQuery = { name: "ɵɵloadQuery", moduleName: CORE };
  static contentQuery = { name: "ɵɵcontentQuery", moduleName: CORE };
  // Signal queries
  static viewQuerySignal = { name: "ɵɵviewQuerySignal", moduleName: CORE };
  static contentQuerySignal = { name: "ɵɵcontentQuerySignal", moduleName: CORE };
  static queryAdvance = { name: "ɵɵqueryAdvance", moduleName: CORE };
  // Two-way bindings
  static twoWayProperty = { name: "ɵɵtwoWayProperty", moduleName: CORE };
  static twoWayBindingSet = { name: "ɵɵtwoWayBindingSet", moduleName: CORE };
  static twoWayListener = { name: "ɵɵtwoWayListener", moduleName: CORE };
  static declareLet = { name: "ɵɵdeclareLet", moduleName: CORE };
  static storeLet = { name: "ɵɵstoreLet", moduleName: CORE };
  static readContextLet = { name: "ɵɵreadContextLet", moduleName: CORE };
  static NgOnChangesFeature = { name: "ɵɵNgOnChangesFeature", moduleName: CORE };
  static InheritDefinitionFeature = {
    name: "ɵɵInheritDefinitionFeature",
    moduleName: CORE
  };
  static CopyDefinitionFeature = {
    name: "ɵɵCopyDefinitionFeature",
    moduleName: CORE
  };
  static ProvidersFeature = { name: "ɵɵProvidersFeature", moduleName: CORE };
  static HostDirectivesFeature = {
    name: "ɵɵHostDirectivesFeature",
    moduleName: CORE
  };
  static InputTransformsFeatureFeature = {
    name: "ɵɵInputTransformsFeature",
    moduleName: CORE
  };
  static ExternalStylesFeature = {
    name: "ɵɵExternalStylesFeature",
    moduleName: CORE
  };
  static listener = { name: "ɵɵlistener", moduleName: CORE };
  static getInheritedFactory = {
    name: "ɵɵgetInheritedFactory",
    moduleName: CORE
  };
  // sanitization-related functions
  static sanitizeHtml = { name: "ɵɵsanitizeHtml", moduleName: CORE };
  static sanitizeStyle = { name: "ɵɵsanitizeStyle", moduleName: CORE };
  static sanitizeResourceUrl = {
    name: "ɵɵsanitizeResourceUrl",
    moduleName: CORE
  };
  static sanitizeScript = { name: "ɵɵsanitizeScript", moduleName: CORE };
  static sanitizeUrl = { name: "ɵɵsanitizeUrl", moduleName: CORE };
  static sanitizeUrlOrResourceUrl = {
    name: "ɵɵsanitizeUrlOrResourceUrl",
    moduleName: CORE
  };
  static trustConstantHtml = { name: "ɵɵtrustConstantHtml", moduleName: CORE };
  static trustConstantResourceUrl = {
    name: "ɵɵtrustConstantResourceUrl",
    moduleName: CORE
  };
  static validateIframeAttribute = {
    name: "ɵɵvalidateIframeAttribute",
    moduleName: CORE
  };
  // type-checking
  static InputSignalBrandWriteType = { name: "ɵINPUT_SIGNAL_BRAND_WRITE_TYPE", moduleName: CORE };
  static UnwrapDirectiveSignalInputs = { name: "ɵUnwrapDirectiveSignalInputs", moduleName: CORE };
  static unwrapWritableSignal = { name: "ɵunwrapWritableSignal", moduleName: CORE };
}
const DASH_CASE_REGEXP = /-+([a-z0-9])/g;
function dashCaseToCamelCase(input) {
  return input.replace(DASH_CASE_REGEXP, (...m) => m[1].toUpperCase());
}
function splitAtColon(input, defaultValues) {
  return _splitAt(input, ":", defaultValues);
}
function splitAtPeriod(input, defaultValues) {
  return _splitAt(input, ".", defaultValues);
}
function _splitAt(input, character, defaultValues) {
  const characterIndex = input.indexOf(character);
  if (characterIndex == -1)
    return defaultValues;
  return [input.slice(0, characterIndex).trim(), input.slice(characterIndex + 1).trim()];
}
function noUndefined(val) {
  return val === void 0 ? null : val;
}
function utf8Encode(str) {
  let encoded = [];
  for (let index = 0; index < str.length; index++) {
    let codePoint = str.charCodeAt(index);
    if (codePoint >= 55296 && codePoint <= 56319 && str.length > index + 1) {
      const low = str.charCodeAt(index + 1);
      if (low >= 56320 && low <= 57343) {
        index++;
        codePoint = (codePoint - 55296 << 10) + low - 56320 + 65536;
      }
    }
    if (codePoint <= 127) {
      encoded.push(codePoint);
    } else if (codePoint <= 2047) {
      encoded.push(codePoint >> 6 & 31 | 192, codePoint & 63 | 128);
    } else if (codePoint <= 65535) {
      encoded.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else if (codePoint <= 2097151) {
      encoded.push(codePoint >> 18 & 7 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    }
  }
  return encoded;
}
function stringify(token) {
  if (typeof token === "string") {
    return token;
  }
  if (Array.isArray(token)) {
    return "[" + token.map(stringify).join(", ") + "]";
  }
  if (token == null) {
    return "" + token;
  }
  if (token.overriddenName) {
    return `${token.overriddenName}`;
  }
  if (token.name) {
    return `${token.name}`;
  }
  if (!token.toString) {
    return "object";
  }
  const res = token.toString();
  if (res == null) {
    return "" + res;
  }
  const newLineIndex = res.indexOf("\n");
  return newLineIndex === -1 ? res : res.substring(0, newLineIndex);
}
class Version {
  full;
  major;
  minor;
  patch;
  constructor(full) {
    this.full = full;
    const splits = full.split(".");
    this.major = splits[0];
    this.minor = splits[1];
    this.patch = splits.slice(2).join(".");
  }
}
const _global = globalThis;
const V1_TO_18 = /^([1-9]|1[0-8])\./;
function getJitStandaloneDefaultForVersion(version) {
  if (version.startsWith("0.")) {
    return true;
  }
  if (V1_TO_18.test(version)) {
    return false;
  }
  return true;
}
const VERSION$1 = 3;
const JS_B64_PREFIX = "# sourceMappingURL=data:application/json;base64,";
class SourceMapGenerator {
  file;
  sourcesContent = /* @__PURE__ */ new Map();
  lines = [];
  lastCol0 = 0;
  hasMappings = false;
  constructor(file = null) {
    this.file = file;
  }
  // The content is `null` when the content is expected to be loaded using the URL
  addSource(url, content = null) {
    if (!this.sourcesContent.has(url)) {
      this.sourcesContent.set(url, content);
    }
    return this;
  }
  addLine() {
    this.lines.push([]);
    this.lastCol0 = 0;
    return this;
  }
  addMapping(col0, sourceUrl, sourceLine0, sourceCol0) {
    if (!this.currentLine) {
      throw new Error(`A line must be added before mappings can be added`);
    }
    if (sourceUrl != null && !this.sourcesContent.has(sourceUrl)) {
      throw new Error(`Unknown source file "${sourceUrl}"`);
    }
    if (col0 == null) {
      throw new Error(`The column in the generated code must be provided`);
    }
    if (col0 < this.lastCol0) {
      throw new Error(`Mapping should be added in output order`);
    }
    if (sourceUrl && (sourceLine0 == null || sourceCol0 == null)) {
      throw new Error(`The source location must be provided when a source url is provided`);
    }
    this.hasMappings = true;
    this.lastCol0 = col0;
    this.currentLine.push({ col0, sourceUrl, sourceLine0, sourceCol0 });
    return this;
  }
  /**
   * @internal strip this from published d.ts files due to
   * https://github.com/microsoft/TypeScript/issues/36216
   */
  get currentLine() {
    return this.lines.slice(-1)[0];
  }
  toJSON() {
    if (!this.hasMappings) {
      return null;
    }
    const sourcesIndex = /* @__PURE__ */ new Map();
    const sources = [];
    const sourcesContent = [];
    Array.from(this.sourcesContent.keys()).forEach((url, i) => {
      sourcesIndex.set(url, i);
      sources.push(url);
      sourcesContent.push(this.sourcesContent.get(url) || null);
    });
    let mappings = "";
    let lastCol0 = 0;
    let lastSourceIndex = 0;
    let lastSourceLine0 = 0;
    let lastSourceCol0 = 0;
    this.lines.forEach((segments) => {
      lastCol0 = 0;
      mappings += segments.map((segment) => {
        let segAsStr = toBase64VLQ(segment.col0 - lastCol0);
        lastCol0 = segment.col0;
        if (segment.sourceUrl != null) {
          segAsStr += toBase64VLQ(sourcesIndex.get(segment.sourceUrl) - lastSourceIndex);
          lastSourceIndex = sourcesIndex.get(segment.sourceUrl);
          segAsStr += toBase64VLQ(segment.sourceLine0 - lastSourceLine0);
          lastSourceLine0 = segment.sourceLine0;
          segAsStr += toBase64VLQ(segment.sourceCol0 - lastSourceCol0);
          lastSourceCol0 = segment.sourceCol0;
        }
        return segAsStr;
      }).join(",");
      mappings += ";";
    });
    mappings = mappings.slice(0, -1);
    return {
      "file": this.file || "",
      "version": VERSION$1,
      "sourceRoot": "",
      "sources": sources,
      "sourcesContent": sourcesContent,
      "mappings": mappings
    };
  }
  toJsComment() {
    return this.hasMappings ? "//" + JS_B64_PREFIX + toBase64String(JSON.stringify(this, null, 0)) : "";
  }
}
function toBase64String(value) {
  let b64 = "";
  const encoded = utf8Encode(value);
  for (let i = 0; i < encoded.length; ) {
    const i1 = encoded[i++];
    const i2 = i < encoded.length ? encoded[i++] : null;
    const i3 = i < encoded.length ? encoded[i++] : null;
    b64 += toBase64Digit(i1 >> 2);
    b64 += toBase64Digit((i1 & 3) << 4 | (i2 === null ? 0 : i2 >> 4));
    b64 += i2 === null ? "=" : toBase64Digit((i2 & 15) << 2 | (i3 === null ? 0 : i3 >> 6));
    b64 += i2 === null || i3 === null ? "=" : toBase64Digit(i3 & 63);
  }
  return b64;
}
function toBase64VLQ(value) {
  value = value < 0 ? (-value << 1) + 1 : value << 1;
  let out = "";
  do {
    let digit = value & 31;
    value = value >> 5;
    if (value > 0) {
      digit = digit | 32;
    }
    out += toBase64Digit(digit);
  } while (value > 0);
  return out;
}
const B64_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64Digit(value) {
  if (value < 0 || value >= 64) {
    throw new Error(`Can only encode value in the range [0, 63]`);
  }
  return B64_DIGITS[value];
}
const _SINGLE_QUOTE_ESCAPE_STRING_RE = /'|\\|\n|\r|\$/g;
const _LEGAL_IDENTIFIER_RE = /^[$A-Z_][0-9A-Z_$]*$/i;
const _INDENT_WITH = "  ";
class _EmittedLine {
  indent;
  partsLength = 0;
  parts = [];
  srcSpans = [];
  constructor(indent) {
    this.indent = indent;
  }
}
class EmitterVisitorContext {
  _indent;
  static createRoot() {
    return new EmitterVisitorContext(0);
  }
  _lines;
  constructor(_indent) {
    this._indent = _indent;
    this._lines = [new _EmittedLine(_indent)];
  }
  /**
   * @internal strip this from published d.ts files due to
   * https://github.com/microsoft/TypeScript/issues/36216
   */
  get _currentLine() {
    return this._lines[this._lines.length - 1];
  }
  println(from, lastPart = "") {
    this.print(from || null, lastPart, true);
  }
  lineIsEmpty() {
    return this._currentLine.parts.length === 0;
  }
  lineLength() {
    return this._currentLine.indent * _INDENT_WITH.length + this._currentLine.partsLength;
  }
  print(from, part, newLine = false) {
    if (part.length > 0) {
      this._currentLine.parts.push(part);
      this._currentLine.partsLength += part.length;
      this._currentLine.srcSpans.push(from && from.sourceSpan || null);
    }
    if (newLine) {
      this._lines.push(new _EmittedLine(this._indent));
    }
  }
  removeEmptyLastLine() {
    if (this.lineIsEmpty()) {
      this._lines.pop();
    }
  }
  incIndent() {
    this._indent++;
    if (this.lineIsEmpty()) {
      this._currentLine.indent = this._indent;
    }
  }
  decIndent() {
    this._indent--;
    if (this.lineIsEmpty()) {
      this._currentLine.indent = this._indent;
    }
  }
  toSource() {
    return this.sourceLines.map((l) => l.parts.length > 0 ? _createIndent(l.indent) + l.parts.join("") : "").join("\n");
  }
  toSourceMapGenerator(genFilePath, startsAtLine = 0) {
    const map = new SourceMapGenerator(genFilePath);
    let firstOffsetMapped = false;
    const mapFirstOffsetIfNeeded = () => {
      if (!firstOffsetMapped) {
        map.addSource(genFilePath, " ").addMapping(0, genFilePath, 0, 0);
        firstOffsetMapped = true;
      }
    };
    for (let i = 0; i < startsAtLine; i++) {
      map.addLine();
      mapFirstOffsetIfNeeded();
    }
    this.sourceLines.forEach((line, lineIdx) => {
      map.addLine();
      const spans = line.srcSpans;
      const parts = line.parts;
      let col0 = line.indent * _INDENT_WITH.length;
      let spanIdx = 0;
      while (spanIdx < spans.length && !spans[spanIdx]) {
        col0 += parts[spanIdx].length;
        spanIdx++;
      }
      if (spanIdx < spans.length && lineIdx === 0 && col0 === 0) {
        firstOffsetMapped = true;
      } else {
        mapFirstOffsetIfNeeded();
      }
      while (spanIdx < spans.length) {
        const span = spans[spanIdx];
        const source = span.start.file;
        const sourceLine = span.start.line;
        const sourceCol = span.start.col;
        map.addSource(source.url, source.content).addMapping(col0, source.url, sourceLine, sourceCol);
        col0 += parts[spanIdx].length;
        spanIdx++;
        while (spanIdx < spans.length && (span === spans[spanIdx] || !spans[spanIdx])) {
          col0 += parts[spanIdx].length;
          spanIdx++;
        }
      }
    });
    return map;
  }
  spanOf(line, column) {
    const emittedLine = this._lines[line];
    if (emittedLine) {
      let columnsLeft = column - _createIndent(emittedLine.indent).length;
      for (let partIndex = 0; partIndex < emittedLine.parts.length; partIndex++) {
        const part = emittedLine.parts[partIndex];
        if (part.length > columnsLeft) {
          return emittedLine.srcSpans[partIndex];
        }
        columnsLeft -= part.length;
      }
    }
    return null;
  }
  /**
   * @internal strip this from published d.ts files due to
   * https://github.com/microsoft/TypeScript/issues/36216
   */
  get sourceLines() {
    if (this._lines.length && this._lines[this._lines.length - 1].parts.length === 0) {
      return this._lines.slice(0, -1);
    }
    return this._lines;
  }
}
class AbstractEmitterVisitor {
  _escapeDollarInStrings;
  constructor(_escapeDollarInStrings) {
    this._escapeDollarInStrings = _escapeDollarInStrings;
  }
  printLeadingComments(stmt, ctx) {
    if (stmt.leadingComments === void 0) {
      return;
    }
    for (const comment of stmt.leadingComments) {
      if (comment instanceof JSDocComment) {
        ctx.print(stmt, `/*${comment.toString()}*/`, comment.trailingNewline);
      } else {
        if (comment.multiline) {
          ctx.print(stmt, `/* ${comment.text} */`, comment.trailingNewline);
        } else {
          comment.text.split("\n").forEach((line) => {
            ctx.println(stmt, `// ${line}`);
          });
        }
      }
    }
  }
  visitExpressionStmt(stmt, ctx) {
    this.printLeadingComments(stmt, ctx);
    stmt.expr.visitExpression(this, ctx);
    ctx.println(stmt, ";");
    return null;
  }
  visitReturnStmt(stmt, ctx) {
    this.printLeadingComments(stmt, ctx);
    ctx.print(stmt, `return `);
    stmt.value.visitExpression(this, ctx);
    ctx.println(stmt, ";");
    return null;
  }
  visitIfStmt(stmt, ctx) {
    this.printLeadingComments(stmt, ctx);
    ctx.print(stmt, `if (`);
    stmt.condition.visitExpression(this, ctx);
    ctx.print(stmt, `) {`);
    const hasElseCase = stmt.falseCase != null && stmt.falseCase.length > 0;
    if (stmt.trueCase.length <= 1 && !hasElseCase) {
      ctx.print(stmt, ` `);
      this.visitAllStatements(stmt.trueCase, ctx);
      ctx.removeEmptyLastLine();
      ctx.print(stmt, ` `);
    } else {
      ctx.println();
      ctx.incIndent();
      this.visitAllStatements(stmt.trueCase, ctx);
      ctx.decIndent();
      if (hasElseCase) {
        ctx.println(stmt, `} else {`);
        ctx.incIndent();
        this.visitAllStatements(stmt.falseCase, ctx);
        ctx.decIndent();
      }
    }
    ctx.println(stmt, `}`);
    return null;
  }
  visitWriteVarExpr(expr, ctx) {
    const lineWasEmpty = ctx.lineIsEmpty();
    if (!lineWasEmpty) {
      ctx.print(expr, "(");
    }
    ctx.print(expr, `${expr.name} = `);
    expr.value.visitExpression(this, ctx);
    if (!lineWasEmpty) {
      ctx.print(expr, ")");
    }
    return null;
  }
  visitWriteKeyExpr(expr, ctx) {
    const lineWasEmpty = ctx.lineIsEmpty();
    if (!lineWasEmpty) {
      ctx.print(expr, "(");
    }
    expr.receiver.visitExpression(this, ctx);
    ctx.print(expr, `[`);
    expr.index.visitExpression(this, ctx);
    ctx.print(expr, `] = `);
    expr.value.visitExpression(this, ctx);
    if (!lineWasEmpty) {
      ctx.print(expr, ")");
    }
    return null;
  }
  visitWritePropExpr(expr, ctx) {
    const lineWasEmpty = ctx.lineIsEmpty();
    if (!lineWasEmpty) {
      ctx.print(expr, "(");
    }
    expr.receiver.visitExpression(this, ctx);
    ctx.print(expr, `.${expr.name} = `);
    expr.value.visitExpression(this, ctx);
    if (!lineWasEmpty) {
      ctx.print(expr, ")");
    }
    return null;
  }
  visitInvokeFunctionExpr(expr, ctx) {
    const shouldParenthesize = expr.fn instanceof ArrowFunctionExpr;
    if (shouldParenthesize) {
      ctx.print(expr.fn, "(");
    }
    expr.fn.visitExpression(this, ctx);
    if (shouldParenthesize) {
      ctx.print(expr.fn, ")");
    }
    ctx.print(expr, `(`);
    this.visitAllExpressions(expr.args, ctx, ",");
    ctx.print(expr, `)`);
    return null;
  }
  visitTaggedTemplateExpr(expr, ctx) {
    expr.tag.visitExpression(this, ctx);
    ctx.print(expr, "`" + expr.template.elements[0].rawText);
    for (let i = 1; i < expr.template.elements.length; i++) {
      ctx.print(expr, "${");
      expr.template.expressions[i - 1].visitExpression(this, ctx);
      ctx.print(expr, `}${expr.template.elements[i].rawText}`);
    }
    ctx.print(expr, "`");
    return null;
  }
  visitWrappedNodeExpr(ast, ctx) {
    throw new Error("Abstract emitter cannot visit WrappedNodeExpr.");
  }
  visitTypeofExpr(expr, ctx) {
    ctx.print(expr, "typeof ");
    expr.expr.visitExpression(this, ctx);
  }
  visitReadVarExpr(ast, ctx) {
    ctx.print(ast, ast.name);
    return null;
  }
  visitInstantiateExpr(ast, ctx) {
    ctx.print(ast, `new `);
    ast.classExpr.visitExpression(this, ctx);
    ctx.print(ast, `(`);
    this.visitAllExpressions(ast.args, ctx, ",");
    ctx.print(ast, `)`);
    return null;
  }
  visitLiteralExpr(ast, ctx) {
    const value = ast.value;
    if (typeof value === "string") {
      ctx.print(ast, escapeIdentifier(value, this._escapeDollarInStrings));
    } else {
      ctx.print(ast, `${value}`);
    }
    return null;
  }
  visitLocalizedString(ast, ctx) {
    const head = ast.serializeI18nHead();
    ctx.print(ast, "$localize `" + head.raw);
    for (let i = 1; i < ast.messageParts.length; i++) {
      ctx.print(ast, "${");
      ast.expressions[i - 1].visitExpression(this, ctx);
      ctx.print(ast, `}${ast.serializeI18nTemplatePart(i).raw}`);
    }
    ctx.print(ast, "`");
    return null;
  }
  visitConditionalExpr(ast, ctx) {
    ctx.print(ast, `(`);
    ast.condition.visitExpression(this, ctx);
    ctx.print(ast, "? ");
    ast.trueCase.visitExpression(this, ctx);
    ctx.print(ast, ": ");
    ast.falseCase.visitExpression(this, ctx);
    ctx.print(ast, `)`);
    return null;
  }
  visitDynamicImportExpr(ast, ctx) {
    ctx.print(ast, `import(${ast.url})`);
  }
  visitNotExpr(ast, ctx) {
    ctx.print(ast, "!");
    ast.condition.visitExpression(this, ctx);
    return null;
  }
  visitUnaryOperatorExpr(ast, ctx) {
    let opStr;
    switch (ast.operator) {
      case UnaryOperator.Plus:
        opStr = "+";
        break;
      case UnaryOperator.Minus:
        opStr = "-";
        break;
      default:
        throw new Error(`Unknown operator ${ast.operator}`);
    }
    if (ast.parens)
      ctx.print(ast, `(`);
    ctx.print(ast, opStr);
    ast.expr.visitExpression(this, ctx);
    if (ast.parens)
      ctx.print(ast, `)`);
    return null;
  }
  visitBinaryOperatorExpr(ast, ctx) {
    let opStr;
    switch (ast.operator) {
      case BinaryOperator.Equals:
        opStr = "==";
        break;
      case BinaryOperator.Identical:
        opStr = "===";
        break;
      case BinaryOperator.NotEquals:
        opStr = "!=";
        break;
      case BinaryOperator.NotIdentical:
        opStr = "!==";
        break;
      case BinaryOperator.And:
        opStr = "&&";
        break;
      case BinaryOperator.BitwiseOr:
        opStr = "|";
        break;
      case BinaryOperator.BitwiseAnd:
        opStr = "&";
        break;
      case BinaryOperator.Or:
        opStr = "||";
        break;
      case BinaryOperator.Plus:
        opStr = "+";
        break;
      case BinaryOperator.Minus:
        opStr = "-";
        break;
      case BinaryOperator.Divide:
        opStr = "/";
        break;
      case BinaryOperator.Multiply:
        opStr = "*";
        break;
      case BinaryOperator.Modulo:
        opStr = "%";
        break;
      case BinaryOperator.Lower:
        opStr = "<";
        break;
      case BinaryOperator.LowerEquals:
        opStr = "<=";
        break;
      case BinaryOperator.Bigger:
        opStr = ">";
        break;
      case BinaryOperator.BiggerEquals:
        opStr = ">=";
        break;
      case BinaryOperator.NullishCoalesce:
        opStr = "??";
        break;
      default:
        throw new Error(`Unknown operator ${ast.operator}`);
    }
    if (ast.parens)
      ctx.print(ast, `(`);
    ast.lhs.visitExpression(this, ctx);
    ctx.print(ast, ` ${opStr} `);
    ast.rhs.visitExpression(this, ctx);
    if (ast.parens)
      ctx.print(ast, `)`);
    return null;
  }
  visitReadPropExpr(ast, ctx) {
    ast.receiver.visitExpression(this, ctx);
    ctx.print(ast, `.`);
    ctx.print(ast, ast.name);
    return null;
  }
  visitReadKeyExpr(ast, ctx) {
    ast.receiver.visitExpression(this, ctx);
    ctx.print(ast, `[`);
    ast.index.visitExpression(this, ctx);
    ctx.print(ast, `]`);
    return null;
  }
  visitLiteralArrayExpr(ast, ctx) {
    ctx.print(ast, `[`);
    this.visitAllExpressions(ast.entries, ctx, ",");
    ctx.print(ast, `]`);
    return null;
  }
  visitLiteralMapExpr(ast, ctx) {
    ctx.print(ast, `{`);
    this.visitAllObjects((entry) => {
      ctx.print(ast, `${escapeIdentifier(entry.key, this._escapeDollarInStrings, entry.quoted)}:`);
      entry.value.visitExpression(this, ctx);
    }, ast.entries, ctx, ",");
    ctx.print(ast, `}`);
    return null;
  }
  visitCommaExpr(ast, ctx) {
    ctx.print(ast, "(");
    this.visitAllExpressions(ast.parts, ctx, ",");
    ctx.print(ast, ")");
    return null;
  }
  visitAllExpressions(expressions, ctx, separator) {
    this.visitAllObjects((expr) => expr.visitExpression(this, ctx), expressions, ctx, separator);
  }
  visitAllObjects(handler, expressions, ctx, separator) {
    let incrementedIndent = false;
    for (let i = 0; i < expressions.length; i++) {
      if (i > 0) {
        if (ctx.lineLength() > 80) {
          ctx.print(null, separator, true);
          if (!incrementedIndent) {
            ctx.incIndent();
            ctx.incIndent();
            incrementedIndent = true;
          }
        } else {
          ctx.print(null, separator, false);
        }
      }
      handler(expressions[i]);
    }
    if (incrementedIndent) {
      ctx.decIndent();
      ctx.decIndent();
    }
  }
  visitAllStatements(statements, ctx) {
    statements.forEach((stmt) => stmt.visitStatement(this, ctx));
  }
}
function escapeIdentifier(input, escapeDollar, alwaysQuote = true) {
  if (input == null) {
    return null;
  }
  const body = input.replace(_SINGLE_QUOTE_ESCAPE_STRING_RE, (...match) => {
    if (match[0] == "$") {
      return escapeDollar ? "\\$" : "$";
    } else if (match[0] == "\n") {
      return "\\n";
    } else if (match[0] == "\r") {
      return "\\r";
    } else {
      return `\\${match[0]}`;
    }
  });
  const requiresQuotes = alwaysQuote || !_LEGAL_IDENTIFIER_RE.test(body);
  return requiresQuotes ? `'${body}'` : body;
}
function _createIndent(count) {
  let res = "";
  for (let i = 0; i < count; i++) {
    res += _INDENT_WITH;
  }
  return res;
}
function typeWithParameters(type, numParams) {
  if (numParams === 0) {
    return expressionType(type);
  }
  const params = [];
  for (let i = 0; i < numParams; i++) {
    params.push(DYNAMIC_TYPE);
  }
  return expressionType(type, void 0, params);
}
function getSafePropertyAccessString(accessor, name) {
  const escapedName = escapeIdentifier(name, false, false);
  return escapedName !== name ? `${accessor}[${escapedName}]` : `${accessor}.${name}`;
}
function jitOnlyGuardedExpression(expr) {
  return guardedExpression("ngJitMode", expr);
}
function devOnlyGuardedExpression(expr) {
  return guardedExpression("ngDevMode", expr);
}
function guardedExpression(guard, expr) {
  const guardExpr = new ExternalExpr({ name: guard, moduleName: null });
  const guardNotDefined = new BinaryOperatorExpr(BinaryOperator.Identical, new TypeofExpr(guardExpr), literal("undefined"));
  const guardUndefinedOrTrue = new BinaryOperatorExpr(
    BinaryOperator.Or,
    guardNotDefined,
    guardExpr,
    /* type */
    void 0,
    /* sourceSpan */
    void 0,
    true
  );
  return new BinaryOperatorExpr(BinaryOperator.And, guardUndefinedOrTrue, expr);
}
function wrapReference(value) {
  const wrapped = new WrappedNodeExpr(value);
  return { value: wrapped, type: wrapped };
}
function refsToArray(refs, shouldForwardDeclare) {
  const values = literalArr(refs.map((ref) => ref.value));
  return shouldForwardDeclare ? arrowFn([], values) : values;
}
function createMayBeForwardRefExpression(expression, forwardRef) {
  return { expression, forwardRef };
}
function convertFromMaybeForwardRefExpression({ expression, forwardRef }) {
  switch (forwardRef) {
    case 0:
    case 1:
      return expression;
    case 2:
      return generateForwardRef(expression);
  }
}
function generateForwardRef(expr) {
  return importExpr(Identifiers.forwardRef).callFn([arrowFn([], expr)]);
}
var R3FactoryDelegateType;
(function(R3FactoryDelegateType2) {
  R3FactoryDelegateType2[R3FactoryDelegateType2["Class"] = 0] = "Class";
  R3FactoryDelegateType2[R3FactoryDelegateType2["Function"] = 1] = "Function";
})(R3FactoryDelegateType || (R3FactoryDelegateType = {}));
var FactoryTarget$1;
(function(FactoryTarget2) {
  FactoryTarget2[FactoryTarget2["Directive"] = 0] = "Directive";
  FactoryTarget2[FactoryTarget2["Component"] = 1] = "Component";
  FactoryTarget2[FactoryTarget2["Injectable"] = 2] = "Injectable";
  FactoryTarget2[FactoryTarget2["Pipe"] = 3] = "Pipe";
  FactoryTarget2[FactoryTarget2["NgModule"] = 4] = "NgModule";
})(FactoryTarget$1 || (FactoryTarget$1 = {}));
function compileFactoryFunction(meta) {
  const t = variable("__ngFactoryType__");
  let baseFactoryVar = null;
  const typeForCtor = !isDelegatedFactoryMetadata(meta) ? new BinaryOperatorExpr(BinaryOperator.Or, t, meta.type.value) : t;
  let ctorExpr = null;
  if (meta.deps !== null) {
    if (meta.deps !== "invalid") {
      ctorExpr = new InstantiateExpr(typeForCtor, injectDependencies(meta.deps, meta.target));
    }
  } else {
    baseFactoryVar = variable(`ɵ${meta.name}_BaseFactory`);
    ctorExpr = baseFactoryVar.callFn([typeForCtor]);
  }
  const body = [];
  let retExpr = null;
  function makeConditionalFactory(nonCtorExpr) {
    const r = variable("__ngConditionalFactory__");
    body.push(r.set(NULL_EXPR).toDeclStmt());
    const ctorStmt = ctorExpr !== null ? r.set(ctorExpr).toStmt() : importExpr(Identifiers.invalidFactory).callFn([]).toStmt();
    body.push(ifStmt(t, [ctorStmt], [r.set(nonCtorExpr).toStmt()]));
    return r;
  }
  if (isDelegatedFactoryMetadata(meta)) {
    const delegateArgs = injectDependencies(meta.delegateDeps, meta.target);
    const factoryExpr = new (meta.delegateType === R3FactoryDelegateType.Class ? InstantiateExpr : InvokeFunctionExpr)(meta.delegate, delegateArgs);
    retExpr = makeConditionalFactory(factoryExpr);
  } else if (isExpressionFactoryMetadata(meta)) {
    retExpr = makeConditionalFactory(meta.expression);
  } else {
    retExpr = ctorExpr;
  }
  if (retExpr === null) {
    body.push(importExpr(Identifiers.invalidFactory).callFn([]).toStmt());
  } else if (baseFactoryVar !== null) {
    const getInheritedFactoryCall = importExpr(Identifiers.getInheritedFactory).callFn([meta.type.value]);
    const baseFactory = new BinaryOperatorExpr(BinaryOperator.Or, baseFactoryVar, baseFactoryVar.set(getInheritedFactoryCall));
    body.push(new ReturnStatement(baseFactory.callFn([typeForCtor])));
  } else {
    body.push(new ReturnStatement(retExpr));
  }
  let factoryFn = fn([new FnParam(t.name, DYNAMIC_TYPE)], body, INFERRED_TYPE, void 0, `${meta.name}_Factory`);
  if (baseFactoryVar !== null) {
    factoryFn = arrowFn([], [new DeclareVarStmt(baseFactoryVar.name), new ReturnStatement(factoryFn)]).callFn(
      [],
      /* sourceSpan */
      void 0,
      /* pure */
      true
    );
  }
  return {
    expression: factoryFn,
    statements: [],
    type: createFactoryType(meta)
  };
}
function createFactoryType(meta) {
  const ctorDepsType = meta.deps !== null && meta.deps !== "invalid" ? createCtorDepsType(meta.deps) : NONE_TYPE;
  return expressionType(importExpr(Identifiers.FactoryDeclaration, [
    typeWithParameters(meta.type.type, meta.typeArgumentCount),
    ctorDepsType
  ]));
}
function injectDependencies(deps, target) {
  return deps.map((dep, index) => compileInjectDependency(dep, target, index));
}
function compileInjectDependency(dep, target, index) {
  if (dep.token === null) {
    return importExpr(Identifiers.invalidFactoryDep).callFn([literal(index)]);
  } else if (dep.attributeNameType === null) {
    const flags = 0 | (dep.self ? 2 : 0) | (dep.skipSelf ? 4 : 0) | (dep.host ? 1 : 0) | (dep.optional ? 8 : 0) | (target === FactoryTarget$1.Pipe ? 16 : 0);
    let flagsParam = flags !== 0 || dep.optional ? literal(flags) : null;
    const injectArgs = [dep.token];
    if (flagsParam) {
      injectArgs.push(flagsParam);
    }
    const injectFn = getInjectFn(target);
    return importExpr(injectFn).callFn(injectArgs);
  } else {
    return importExpr(Identifiers.injectAttribute).callFn([dep.token]);
  }
}
function createCtorDepsType(deps) {
  let hasTypes = false;
  const attributeTypes = deps.map((dep) => {
    const type = createCtorDepType(dep);
    if (type !== null) {
      hasTypes = true;
      return type;
    } else {
      return literal(null);
    }
  });
  if (hasTypes) {
    return expressionType(literalArr(attributeTypes));
  } else {
    return NONE_TYPE;
  }
}
function createCtorDepType(dep) {
  const entries = [];
  if (dep.attributeNameType !== null) {
    entries.push({ key: "attribute", value: dep.attributeNameType, quoted: false });
  }
  if (dep.optional) {
    entries.push({ key: "optional", value: literal(true), quoted: false });
  }
  if (dep.host) {
    entries.push({ key: "host", value: literal(true), quoted: false });
  }
  if (dep.self) {
    entries.push({ key: "self", value: literal(true), quoted: false });
  }
  if (dep.skipSelf) {
    entries.push({ key: "skipSelf", value: literal(true), quoted: false });
  }
  return entries.length > 0 ? literalMap(entries) : null;
}
function isDelegatedFactoryMetadata(meta) {
  return meta.delegateType !== void 0;
}
function isExpressionFactoryMetadata(meta) {
  return meta.expression !== void 0;
}
function getInjectFn(target) {
  switch (target) {
    case FactoryTarget$1.Component:
    case FactoryTarget$1.Directive:
    case FactoryTarget$1.Pipe:
      return Identifiers.directiveInject;
    case FactoryTarget$1.NgModule:
    case FactoryTarget$1.Injectable:
    default:
      return Identifiers.inject;
  }
}
class ParserError {
  input;
  errLocation;
  ctxLocation;
  message;
  constructor(message, input, errLocation, ctxLocation) {
    this.input = input;
    this.errLocation = errLocation;
    this.ctxLocation = ctxLocation;
    this.message = `Parser Error: ${message} ${errLocation} [${input}] in ${ctxLocation}`;
  }
}
class ParseSpan {
  start;
  end;
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
  toAbsolute(absoluteOffset) {
    return new AbsoluteSourceSpan(absoluteOffset + this.start, absoluteOffset + this.end);
  }
}
class AST {
  span;
  sourceSpan;
  constructor(span, sourceSpan) {
    this.span = span;
    this.sourceSpan = sourceSpan;
  }
  toString() {
    return "AST";
  }
}
class ASTWithName extends AST {
  nameSpan;
  constructor(span, sourceSpan, nameSpan) {
    super(span, sourceSpan);
    this.nameSpan = nameSpan;
  }
}
class EmptyExpr$1 extends AST {
  visit(visitor, context = null) {
  }
}
class ImplicitReceiver extends AST {
  visit(visitor, context = null) {
    return visitor.visitImplicitReceiver(this, context);
  }
}
class ThisReceiver extends ImplicitReceiver {
  visit(visitor, context = null) {
    return visitor.visitThisReceiver?.(this, context);
  }
}
class Chain extends AST {
  expressions;
  constructor(span, sourceSpan, expressions) {
    super(span, sourceSpan);
    this.expressions = expressions;
  }
  visit(visitor, context = null) {
    return visitor.visitChain(this, context);
  }
}
class Conditional extends AST {
  condition;
  trueExp;
  falseExp;
  constructor(span, sourceSpan, condition, trueExp, falseExp) {
    super(span, sourceSpan);
    this.condition = condition;
    this.trueExp = trueExp;
    this.falseExp = falseExp;
  }
  visit(visitor, context = null) {
    return visitor.visitConditional(this, context);
  }
}
class PropertyRead extends ASTWithName {
  receiver;
  name;
  constructor(span, sourceSpan, nameSpan, receiver, name) {
    super(span, sourceSpan, nameSpan);
    this.receiver = receiver;
    this.name = name;
  }
  visit(visitor, context = null) {
    return visitor.visitPropertyRead(this, context);
  }
}
class PropertyWrite extends ASTWithName {
  receiver;
  name;
  value;
  constructor(span, sourceSpan, nameSpan, receiver, name, value) {
    super(span, sourceSpan, nameSpan);
    this.receiver = receiver;
    this.name = name;
    this.value = value;
  }
  visit(visitor, context = null) {
    return visitor.visitPropertyWrite(this, context);
  }
}
class SafePropertyRead extends ASTWithName {
  receiver;
  name;
  constructor(span, sourceSpan, nameSpan, receiver, name) {
    super(span, sourceSpan, nameSpan);
    this.receiver = receiver;
    this.name = name;
  }
  visit(visitor, context = null) {
    return visitor.visitSafePropertyRead(this, context);
  }
}
class KeyedRead extends AST {
  receiver;
  key;
  constructor(span, sourceSpan, receiver, key) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.key = key;
  }
  visit(visitor, context = null) {
    return visitor.visitKeyedRead(this, context);
  }
}
class SafeKeyedRead extends AST {
  receiver;
  key;
  constructor(span, sourceSpan, receiver, key) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.key = key;
  }
  visit(visitor, context = null) {
    return visitor.visitSafeKeyedRead(this, context);
  }
}
class KeyedWrite extends AST {
  receiver;
  key;
  value;
  constructor(span, sourceSpan, receiver, key, value) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.key = key;
    this.value = value;
  }
  visit(visitor, context = null) {
    return visitor.visitKeyedWrite(this, context);
  }
}
class BindingPipe extends ASTWithName {
  exp;
  name;
  args;
  constructor(span, sourceSpan, exp, name, args, nameSpan) {
    super(span, sourceSpan, nameSpan);
    this.exp = exp;
    this.name = name;
    this.args = args;
  }
  visit(visitor, context = null) {
    return visitor.visitPipe(this, context);
  }
}
class LiteralPrimitive extends AST {
  value;
  constructor(span, sourceSpan, value) {
    super(span, sourceSpan);
    this.value = value;
  }
  visit(visitor, context = null) {
    return visitor.visitLiteralPrimitive(this, context);
  }
}
class LiteralArray extends AST {
  expressions;
  constructor(span, sourceSpan, expressions) {
    super(span, sourceSpan);
    this.expressions = expressions;
  }
  visit(visitor, context = null) {
    return visitor.visitLiteralArray(this, context);
  }
}
class LiteralMap extends AST {
  keys;
  values;
  constructor(span, sourceSpan, keys, values) {
    super(span, sourceSpan);
    this.keys = keys;
    this.values = values;
  }
  visit(visitor, context = null) {
    return visitor.visitLiteralMap(this, context);
  }
}
class Interpolation$1 extends AST {
  strings;
  expressions;
  constructor(span, sourceSpan, strings, expressions) {
    super(span, sourceSpan);
    this.strings = strings;
    this.expressions = expressions;
  }
  visit(visitor, context = null) {
    return visitor.visitInterpolation(this, context);
  }
}
class Binary extends AST {
  operation;
  left;
  right;
  constructor(span, sourceSpan, operation, left, right) {
    super(span, sourceSpan);
    this.operation = operation;
    this.left = left;
    this.right = right;
  }
  visit(visitor, context = null) {
    return visitor.visitBinary(this, context);
  }
}
class Unary extends Binary {
  operator;
  expr;
  // Redeclare the properties that are inherited from `Binary` as `never`, as consumers should not
  // depend on these fields when operating on `Unary`.
  left = null;
  right = null;
  operation = null;
  /**
   * Creates a unary minus expression "-x", represented as `Binary` using "0 - x".
   */
  static createMinus(span, sourceSpan, expr) {
    return new Unary(span, sourceSpan, "-", expr, "-", new LiteralPrimitive(span, sourceSpan, 0), expr);
  }
  /**
   * Creates a unary plus expression "+x", represented as `Binary` using "x - 0".
   */
  static createPlus(span, sourceSpan, expr) {
    return new Unary(span, sourceSpan, "+", expr, "-", expr, new LiteralPrimitive(span, sourceSpan, 0));
  }
  /**
   * During the deprecation period this constructor is private, to avoid consumers from creating
   * a `Unary` with the fallback properties for `Binary`.
   */
  constructor(span, sourceSpan, operator, expr, binaryOp, binaryLeft, binaryRight) {
    super(span, sourceSpan, binaryOp, binaryLeft, binaryRight);
    this.operator = operator;
    this.expr = expr;
  }
  visit(visitor, context = null) {
    if (visitor.visitUnary !== void 0) {
      return visitor.visitUnary(this, context);
    }
    return visitor.visitBinary(this, context);
  }
}
class PrefixNot extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context = null) {
    return visitor.visitPrefixNot(this, context);
  }
}
class TypeofExpression extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context = null) {
    return visitor.visitTypeofExpresion(this, context);
  }
}
class NonNullAssert extends AST {
  expression;
  constructor(span, sourceSpan, expression) {
    super(span, sourceSpan);
    this.expression = expression;
  }
  visit(visitor, context = null) {
    return visitor.visitNonNullAssert(this, context);
  }
}
class Call extends AST {
  receiver;
  args;
  argumentSpan;
  constructor(span, sourceSpan, receiver, args, argumentSpan) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.args = args;
    this.argumentSpan = argumentSpan;
  }
  visit(visitor, context = null) {
    return visitor.visitCall(this, context);
  }
}
class SafeCall extends AST {
  receiver;
  args;
  argumentSpan;
  constructor(span, sourceSpan, receiver, args, argumentSpan) {
    super(span, sourceSpan);
    this.receiver = receiver;
    this.args = args;
    this.argumentSpan = argumentSpan;
  }
  visit(visitor, context = null) {
    return visitor.visitSafeCall(this, context);
  }
}
class AbsoluteSourceSpan {
  start;
  end;
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}
class ASTWithSource extends AST {
  ast;
  source;
  location;
  errors;
  constructor(ast, source, location, absoluteOffset, errors) {
    super(new ParseSpan(0, source === null ? 0 : source.length), new AbsoluteSourceSpan(absoluteOffset, source === null ? absoluteOffset : absoluteOffset + source.length));
    this.ast = ast;
    this.source = source;
    this.location = location;
    this.errors = errors;
  }
  visit(visitor, context = null) {
    if (visitor.visitASTWithSource) {
      return visitor.visitASTWithSource(this, context);
    }
    return this.ast.visit(visitor, context);
  }
  toString() {
    return `${this.source} in ${this.location}`;
  }
}
class VariableBinding {
  sourceSpan;
  key;
  value;
  /**
   * @param sourceSpan entire span of the binding.
   * @param key name of the LHS along with its span.
   * @param value optional value for the RHS along with its span.
   */
  constructor(sourceSpan, key, value) {
    this.sourceSpan = sourceSpan;
    this.key = key;
    this.value = value;
  }
}
class ExpressionBinding {
  sourceSpan;
  key;
  value;
  /**
   * @param sourceSpan entire span of the binding.
   * @param key binding name, like ngForOf, ngForTrackBy, ngIf, along with its
   * span. Note that the length of the span may not be the same as
   * `key.source.length`. For example,
   * 1. key.source = ngFor, key.span is for "ngFor"
   * 2. key.source = ngForOf, key.span is for "of"
   * 3. key.source = ngForTrackBy, key.span is for "trackBy"
   * @param value optional expression for the RHS.
   */
  constructor(sourceSpan, key, value) {
    this.sourceSpan = sourceSpan;
    this.key = key;
    this.value = value;
  }
}
class RecursiveAstVisitor {
  visit(ast, context) {
    ast.visit(this, context);
  }
  visitUnary(ast, context) {
    this.visit(ast.expr, context);
  }
  visitBinary(ast, context) {
    this.visit(ast.left, context);
    this.visit(ast.right, context);
  }
  visitChain(ast, context) {
    this.visitAll(ast.expressions, context);
  }
  visitConditional(ast, context) {
    this.visit(ast.condition, context);
    this.visit(ast.trueExp, context);
    this.visit(ast.falseExp, context);
  }
  visitPipe(ast, context) {
    this.visit(ast.exp, context);
    this.visitAll(ast.args, context);
  }
  visitImplicitReceiver(ast, context) {
  }
  visitThisReceiver(ast, context) {
  }
  visitInterpolation(ast, context) {
    this.visitAll(ast.expressions, context);
  }
  visitKeyedRead(ast, context) {
    this.visit(ast.receiver, context);
    this.visit(ast.key, context);
  }
  visitKeyedWrite(ast, context) {
    this.visit(ast.receiver, context);
    this.visit(ast.key, context);
    this.visit(ast.value, context);
  }
  visitLiteralArray(ast, context) {
    this.visitAll(ast.expressions, context);
  }
  visitLiteralMap(ast, context) {
    this.visitAll(ast.values, context);
  }
  visitLiteralPrimitive(ast, context) {
  }
  visitPrefixNot(ast, context) {
    this.visit(ast.expression, context);
  }
  visitTypeofExpresion(ast, context) {
    this.visit(ast.expression, context);
  }
  visitNonNullAssert(ast, context) {
    this.visit(ast.expression, context);
  }
  visitPropertyRead(ast, context) {
    this.visit(ast.receiver, context);
  }
  visitPropertyWrite(ast, context) {
    this.visit(ast.receiver, context);
    this.visit(ast.value, context);
  }
  visitSafePropertyRead(ast, context) {
    this.visit(ast.receiver, context);
  }
  visitSafeKeyedRead(ast, context) {
    this.visit(ast.receiver, context);
    this.visit(ast.key, context);
  }
  visitCall(ast, context) {
    this.visit(ast.receiver, context);
    this.visitAll(ast.args, context);
  }
  visitSafeCall(ast, context) {
    this.visit(ast.receiver, context);
    this.visitAll(ast.args, context);
  }
  // This is not part of the AstVisitor interface, just a helper method
  visitAll(asts, context) {
    for (const ast of asts) {
      this.visit(ast, context);
    }
  }
}
class AstTransformer {
  visitImplicitReceiver(ast, context) {
    return ast;
  }
  visitThisReceiver(ast, context) {
    return ast;
  }
  visitInterpolation(ast, context) {
    return new Interpolation$1(ast.span, ast.sourceSpan, ast.strings, this.visitAll(ast.expressions));
  }
  visitLiteralPrimitive(ast, context) {
    return new LiteralPrimitive(ast.span, ast.sourceSpan, ast.value);
  }
  visitPropertyRead(ast, context) {
    return new PropertyRead(ast.span, ast.sourceSpan, ast.nameSpan, ast.receiver.visit(this), ast.name);
  }
  visitPropertyWrite(ast, context) {
    return new PropertyWrite(ast.span, ast.sourceSpan, ast.nameSpan, ast.receiver.visit(this), ast.name, ast.value.visit(this));
  }
  visitSafePropertyRead(ast, context) {
    return new SafePropertyRead(ast.span, ast.sourceSpan, ast.nameSpan, ast.receiver.visit(this), ast.name);
  }
  visitLiteralArray(ast, context) {
    return new LiteralArray(ast.span, ast.sourceSpan, this.visitAll(ast.expressions));
  }
  visitLiteralMap(ast, context) {
    return new LiteralMap(ast.span, ast.sourceSpan, ast.keys, this.visitAll(ast.values));
  }
  visitUnary(ast, context) {
    switch (ast.operator) {
      case "+":
        return Unary.createPlus(ast.span, ast.sourceSpan, ast.expr.visit(this));
      case "-":
        return Unary.createMinus(ast.span, ast.sourceSpan, ast.expr.visit(this));
      default:
        throw new Error(`Unknown unary operator ${ast.operator}`);
    }
  }
  visitBinary(ast, context) {
    return new Binary(ast.span, ast.sourceSpan, ast.operation, ast.left.visit(this), ast.right.visit(this));
  }
  visitPrefixNot(ast, context) {
    return new PrefixNot(ast.span, ast.sourceSpan, ast.expression.visit(this));
  }
  visitTypeofExpresion(ast, context) {
    return new TypeofExpression(ast.span, ast.sourceSpan, ast.expression.visit(this));
  }
  visitNonNullAssert(ast, context) {
    return new NonNullAssert(ast.span, ast.sourceSpan, ast.expression.visit(this));
  }
  visitConditional(ast, context) {
    return new Conditional(ast.span, ast.sourceSpan, ast.condition.visit(this), ast.trueExp.visit(this), ast.falseExp.visit(this));
  }
  visitPipe(ast, context) {
    return new BindingPipe(ast.span, ast.sourceSpan, ast.exp.visit(this), ast.name, this.visitAll(ast.args), ast.nameSpan);
  }
  visitKeyedRead(ast, context) {
    return new KeyedRead(ast.span, ast.sourceSpan, ast.receiver.visit(this), ast.key.visit(this));
  }
  visitKeyedWrite(ast, context) {
    return new KeyedWrite(ast.span, ast.sourceSpan, ast.receiver.visit(this), ast.key.visit(this), ast.value.visit(this));
  }
  visitCall(ast, context) {
    return new Call(ast.span, ast.sourceSpan, ast.receiver.visit(this), this.visitAll(ast.args), ast.argumentSpan);
  }
  visitSafeCall(ast, context) {
    return new SafeCall(ast.span, ast.sourceSpan, ast.receiver.visit(this), this.visitAll(ast.args), ast.argumentSpan);
  }
  visitAll(asts) {
    const res = [];
    for (let i = 0; i < asts.length; ++i) {
      res[i] = asts[i].visit(this);
    }
    return res;
  }
  visitChain(ast, context) {
    return new Chain(ast.span, ast.sourceSpan, this.visitAll(ast.expressions));
  }
  visitSafeKeyedRead(ast, context) {
    return new SafeKeyedRead(ast.span, ast.sourceSpan, ast.receiver.visit(this), ast.key.visit(this));
  }
}
class AstMemoryEfficientTransformer {
  visitImplicitReceiver(ast, context) {
    return ast;
  }
  visitThisReceiver(ast, context) {
    return ast;
  }
  visitInterpolation(ast, context) {
    const expressions = this.visitAll(ast.expressions);
    if (expressions !== ast.expressions)
      return new Interpolation$1(ast.span, ast.sourceSpan, ast.strings, expressions);
    return ast;
  }
  visitLiteralPrimitive(ast, context) {
    return ast;
  }
  visitPropertyRead(ast, context) {
    const receiver = ast.receiver.visit(this);
    if (receiver !== ast.receiver) {
      return new PropertyRead(ast.span, ast.sourceSpan, ast.nameSpan, receiver, ast.name);
    }
    return ast;
  }
  visitPropertyWrite(ast, context) {
    const receiver = ast.receiver.visit(this);
    const value = ast.value.visit(this);
    if (receiver !== ast.receiver || value !== ast.value) {
      return new PropertyWrite(ast.span, ast.sourceSpan, ast.nameSpan, receiver, ast.name, value);
    }
    return ast;
  }
  visitSafePropertyRead(ast, context) {
    const receiver = ast.receiver.visit(this);
    if (receiver !== ast.receiver) {
      return new SafePropertyRead(ast.span, ast.sourceSpan, ast.nameSpan, receiver, ast.name);
    }
    return ast;
  }
  visitLiteralArray(ast, context) {
    const expressions = this.visitAll(ast.expressions);
    if (expressions !== ast.expressions) {
      return new LiteralArray(ast.span, ast.sourceSpan, expressions);
    }
    return ast;
  }
  visitLiteralMap(ast, context) {
    const values = this.visitAll(ast.values);
    if (values !== ast.values) {
      return new LiteralMap(ast.span, ast.sourceSpan, ast.keys, values);
    }
    return ast;
  }
  visitUnary(ast, context) {
    const expr = ast.expr.visit(this);
    if (expr !== ast.expr) {
      switch (ast.operator) {
        case "+":
          return Unary.createPlus(ast.span, ast.sourceSpan, expr);
        case "-":
          return Unary.createMinus(ast.span, ast.sourceSpan, expr);
        default:
          throw new Error(`Unknown unary operator ${ast.operator}`);
      }
    }
    return ast;
  }
  visitBinary(ast, context) {
    const left = ast.left.visit(this);
    const right = ast.right.visit(this);
    if (left !== ast.left || right !== ast.right) {
      return new Binary(ast.span, ast.sourceSpan, ast.operation, left, right);
    }
    return ast;
  }
  visitPrefixNot(ast, context) {
    const expression = ast.expression.visit(this);
    if (expression !== ast.expression) {
      return new PrefixNot(ast.span, ast.sourceSpan, expression);
    }
    return ast;
  }
  visitTypeofExpresion(ast, context) {
    const expression = ast.expression.visit(this);
    if (expression !== ast.expression) {
      return new TypeofExpression(ast.span, ast.sourceSpan, expression);
    }
    return ast;
  }
  visitNonNullAssert(ast, context) {
    const expression = ast.expression.visit(this);
    if (expression !== ast.expression) {
      return new NonNullAssert(ast.span, ast.sourceSpan, expression);
    }
    return ast;
  }
  visitConditional(ast, context) {
    const condition = ast.condition.visit(this);
    const trueExp = ast.trueExp.visit(this);
    const falseExp = ast.falseExp.visit(this);
    if (condition !== ast.condition || trueExp !== ast.trueExp || falseExp !== ast.falseExp) {
      return new Conditional(ast.span, ast.sourceSpan, condition, trueExp, falseExp);
    }
    return ast;
  }
  visitPipe(ast, context) {
    const exp = ast.exp.visit(this);
    const args = this.visitAll(ast.args);
    if (exp !== ast.exp || args !== ast.args) {
      return new BindingPipe(ast.span, ast.sourceSpan, exp, ast.name, args, ast.nameSpan);
    }
    return ast;
  }
  visitKeyedRead(ast, context) {
    const obj = ast.receiver.visit(this);
    const key = ast.key.visit(this);
    if (obj !== ast.receiver || key !== ast.key) {
      return new KeyedRead(ast.span, ast.sourceSpan, obj, key);
    }
    return ast;
  }
  visitKeyedWrite(ast, context) {
    const obj = ast.receiver.visit(this);
    const key = ast.key.visit(this);
    const value = ast.value.visit(this);
    if (obj !== ast.receiver || key !== ast.key || value !== ast.value) {
      return new KeyedWrite(ast.span, ast.sourceSpan, obj, key, value);
    }
    return ast;
  }
  visitAll(asts) {
    const res = [];
    let modified = false;
    for (let i = 0; i < asts.length; ++i) {
      const original = asts[i];
      const value = original.visit(this);
      res[i] = value;
      modified = modified || value !== original;
    }
    return modified ? res : asts;
  }
  visitChain(ast, context) {
    const expressions = this.visitAll(ast.expressions);
    if (expressions !== ast.expressions) {
      return new Chain(ast.span, ast.sourceSpan, expressions);
    }
    return ast;
  }
  visitCall(ast, context) {
    const receiver = ast.receiver.visit(this);
    const args = this.visitAll(ast.args);
    if (receiver !== ast.receiver || args !== ast.args) {
      return new Call(ast.span, ast.sourceSpan, receiver, args, ast.argumentSpan);
    }
    return ast;
  }
  visitSafeCall(ast, context) {
    const receiver = ast.receiver.visit(this);
    const args = this.visitAll(ast.args);
    if (receiver !== ast.receiver || args !== ast.args) {
      return new SafeCall(ast.span, ast.sourceSpan, receiver, args, ast.argumentSpan);
    }
    return ast;
  }
  visitSafeKeyedRead(ast, context) {
    const obj = ast.receiver.visit(this);
    const key = ast.key.visit(this);
    if (obj !== ast.receiver || key !== ast.key) {
      return new SafeKeyedRead(ast.span, ast.sourceSpan, obj, key);
    }
    return ast;
  }
}
class ParsedProperty {
  name;
  expression;
  type;
  sourceSpan;
  keySpan;
  valueSpan;
  isLiteral;
  isAnimation;
  constructor(name, expression, type, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.expression = expression;
    this.type = type;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
    this.isLiteral = this.type === ParsedPropertyType.LITERAL_ATTR;
    this.isAnimation = this.type === ParsedPropertyType.ANIMATION;
  }
}
var ParsedPropertyType;
(function(ParsedPropertyType2) {
  ParsedPropertyType2[ParsedPropertyType2["DEFAULT"] = 0] = "DEFAULT";
  ParsedPropertyType2[ParsedPropertyType2["LITERAL_ATTR"] = 1] = "LITERAL_ATTR";
  ParsedPropertyType2[ParsedPropertyType2["ANIMATION"] = 2] = "ANIMATION";
  ParsedPropertyType2[ParsedPropertyType2["TWO_WAY"] = 3] = "TWO_WAY";
})(ParsedPropertyType || (ParsedPropertyType = {}));
var ParsedEventType;
(function(ParsedEventType2) {
  ParsedEventType2[ParsedEventType2["Regular"] = 0] = "Regular";
  ParsedEventType2[ParsedEventType2["Animation"] = 1] = "Animation";
  ParsedEventType2[ParsedEventType2["TwoWay"] = 2] = "TwoWay";
})(ParsedEventType || (ParsedEventType = {}));
class ParsedEvent {
  name;
  targetOrPhase;
  type;
  handler;
  sourceSpan;
  handlerSpan;
  keySpan;
  constructor(name, targetOrPhase, type, handler, sourceSpan, handlerSpan, keySpan) {
    this.name = name;
    this.targetOrPhase = targetOrPhase;
    this.type = type;
    this.handler = handler;
    this.sourceSpan = sourceSpan;
    this.handlerSpan = handlerSpan;
    this.keySpan = keySpan;
  }
}
class ParsedVariable {
  name;
  value;
  sourceSpan;
  keySpan;
  valueSpan;
  constructor(name, value, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
  }
}
var BindingType;
(function(BindingType2) {
  BindingType2[BindingType2["Property"] = 0] = "Property";
  BindingType2[BindingType2["Attribute"] = 1] = "Attribute";
  BindingType2[BindingType2["Class"] = 2] = "Class";
  BindingType2[BindingType2["Style"] = 3] = "Style";
  BindingType2[BindingType2["Animation"] = 4] = "Animation";
  BindingType2[BindingType2["TwoWay"] = 5] = "TwoWay";
})(BindingType || (BindingType = {}));
class BoundElementProperty {
  name;
  type;
  securityContext;
  value;
  unit;
  sourceSpan;
  keySpan;
  valueSpan;
  constructor(name, type, securityContext, value, unit, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.type = type;
    this.securityContext = securityContext;
    this.value = value;
    this.unit = unit;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
  }
}
var TagContentType;
(function(TagContentType2) {
  TagContentType2[TagContentType2["RAW_TEXT"] = 0] = "RAW_TEXT";
  TagContentType2[TagContentType2["ESCAPABLE_RAW_TEXT"] = 1] = "ESCAPABLE_RAW_TEXT";
  TagContentType2[TagContentType2["PARSABLE_DATA"] = 2] = "PARSABLE_DATA";
})(TagContentType || (TagContentType = {}));
function splitNsName(elementName, fatal = true) {
  if (elementName[0] != ":") {
    return [null, elementName];
  }
  const colonIndex = elementName.indexOf(":", 1);
  if (colonIndex === -1) {
    if (fatal) {
      throw new Error(`Unsupported format "${elementName}" expecting ":namespace:name"`);
    } else {
      return [null, elementName];
    }
  }
  return [elementName.slice(1, colonIndex), elementName.slice(colonIndex + 1)];
}
function isNgContainer(tagName) {
  return splitNsName(tagName)[1] === "ng-container";
}
function isNgContent(tagName) {
  return splitNsName(tagName)[1] === "ng-content";
}
function isNgTemplate(tagName) {
  return splitNsName(tagName)[1] === "ng-template";
}
function getNsPrefix(fullName) {
  return fullName === null ? null : splitNsName(fullName)[0];
}
function mergeNsAndName(prefix, localName) {
  return prefix ? `:${prefix}:${localName}` : localName;
}
class Comment$1 {
  value;
  sourceSpan;
  constructor(value, sourceSpan) {
    this.value = value;
    this.sourceSpan = sourceSpan;
  }
  visit(_visitor2) {
    throw new Error("visit() not implemented for Comment");
  }
}
class Text$3 {
  value;
  sourceSpan;
  constructor(value, sourceSpan) {
    this.value = value;
    this.sourceSpan = sourceSpan;
  }
  visit(visitor) {
    return visitor.visitText(this);
  }
}
class BoundText {
  value;
  sourceSpan;
  i18n;
  constructor(value, sourceSpan, i18n2) {
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitBoundText(this);
  }
}
class TextAttribute {
  name;
  value;
  sourceSpan;
  keySpan;
  valueSpan;
  i18n;
  constructor(name, value, sourceSpan, keySpan, valueSpan, i18n2) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitTextAttribute(this);
  }
}
class BoundAttribute {
  name;
  type;
  securityContext;
  value;
  unit;
  sourceSpan;
  keySpan;
  valueSpan;
  i18n;
  constructor(name, type, securityContext, value, unit, sourceSpan, keySpan, valueSpan, i18n2) {
    this.name = name;
    this.type = type;
    this.securityContext = securityContext;
    this.value = value;
    this.unit = unit;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
    this.i18n = i18n2;
  }
  static fromBoundElementProperty(prop, i18n2) {
    if (prop.keySpan === void 0) {
      throw new Error(`Unexpected state: keySpan must be defined for bound attributes but was not for ${prop.name}: ${prop.sourceSpan}`);
    }
    return new BoundAttribute(prop.name, prop.type, prop.securityContext, prop.value, prop.unit, prop.sourceSpan, prop.keySpan, prop.valueSpan, i18n2);
  }
  visit(visitor) {
    return visitor.visitBoundAttribute(this);
  }
}
class BoundEvent {
  name;
  type;
  handler;
  target;
  phase;
  sourceSpan;
  handlerSpan;
  keySpan;
  constructor(name, type, handler, target, phase, sourceSpan, handlerSpan, keySpan) {
    this.name = name;
    this.type = type;
    this.handler = handler;
    this.target = target;
    this.phase = phase;
    this.sourceSpan = sourceSpan;
    this.handlerSpan = handlerSpan;
    this.keySpan = keySpan;
  }
  static fromParsedEvent(event) {
    const target = event.type === ParsedEventType.Regular ? event.targetOrPhase : null;
    const phase = event.type === ParsedEventType.Animation ? event.targetOrPhase : null;
    if (event.keySpan === void 0) {
      throw new Error(`Unexpected state: keySpan must be defined for bound event but was not for ${event.name}: ${event.sourceSpan}`);
    }
    return new BoundEvent(event.name, event.type, event.handler, target, phase, event.sourceSpan, event.handlerSpan, event.keySpan);
  }
  visit(visitor) {
    return visitor.visitBoundEvent(this);
  }
}
class Element$1 {
  name;
  attributes;
  inputs;
  outputs;
  children;
  references;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  i18n;
  constructor(name, attributes, inputs, outputs, children, references, sourceSpan, startSourceSpan, endSourceSpan, i18n2) {
    this.name = name;
    this.attributes = attributes;
    this.inputs = inputs;
    this.outputs = outputs;
    this.children = children;
    this.references = references;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitElement(this);
  }
}
class DeferredTrigger {
  nameSpan;
  sourceSpan;
  prefetchSpan;
  whenOrOnSourceSpan;
  hydrateSpan;
  constructor(nameSpan, sourceSpan, prefetchSpan, whenOrOnSourceSpan, hydrateSpan) {
    this.nameSpan = nameSpan;
    this.sourceSpan = sourceSpan;
    this.prefetchSpan = prefetchSpan;
    this.whenOrOnSourceSpan = whenOrOnSourceSpan;
    this.hydrateSpan = hydrateSpan;
  }
  visit(visitor) {
    return visitor.visitDeferredTrigger(this);
  }
}
class BoundDeferredTrigger extends DeferredTrigger {
  value;
  constructor(value, sourceSpan, prefetchSpan, whenSourceSpan, hydrateSpan) {
    super(
      /** nameSpan */
      null,
      sourceSpan,
      prefetchSpan,
      whenSourceSpan,
      hydrateSpan
    );
    this.value = value;
  }
}
class NeverDeferredTrigger extends DeferredTrigger {
}
class IdleDeferredTrigger extends DeferredTrigger {
}
class ImmediateDeferredTrigger extends DeferredTrigger {
}
class HoverDeferredTrigger extends DeferredTrigger {
  reference;
  constructor(reference2, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.reference = reference2;
  }
}
class TimerDeferredTrigger extends DeferredTrigger {
  delay;
  constructor(delay, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.delay = delay;
  }
}
class InteractionDeferredTrigger extends DeferredTrigger {
  reference;
  constructor(reference2, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.reference = reference2;
  }
}
class ViewportDeferredTrigger extends DeferredTrigger {
  reference;
  constructor(reference2, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
    super(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
    this.reference = reference2;
  }
}
class BlockNode {
  nameSpan;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  constructor(nameSpan, sourceSpan, startSourceSpan, endSourceSpan) {
    this.nameSpan = nameSpan;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
  }
}
class DeferredBlockPlaceholder extends BlockNode {
  children;
  minimumTime;
  i18n;
  constructor(children, minimumTime, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n2) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.minimumTime = minimumTime;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitDeferredBlockPlaceholder(this);
  }
}
class DeferredBlockLoading extends BlockNode {
  children;
  afterTime;
  minimumTime;
  i18n;
  constructor(children, afterTime, minimumTime, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n2) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.afterTime = afterTime;
    this.minimumTime = minimumTime;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitDeferredBlockLoading(this);
  }
}
class DeferredBlockError extends BlockNode {
  children;
  i18n;
  constructor(children, nameSpan, sourceSpan, startSourceSpan, endSourceSpan, i18n2) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitDeferredBlockError(this);
  }
}
class DeferredBlock extends BlockNode {
  children;
  placeholder;
  loading;
  error;
  mainBlockSpan;
  i18n;
  triggers;
  prefetchTriggers;
  hydrateTriggers;
  definedTriggers;
  definedPrefetchTriggers;
  definedHydrateTriggers;
  constructor(children, triggers, prefetchTriggers, hydrateTriggers, placeholder, loading, error2, nameSpan, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan, i18n2) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.placeholder = placeholder;
    this.loading = loading;
    this.error = error2;
    this.mainBlockSpan = mainBlockSpan;
    this.i18n = i18n2;
    this.triggers = triggers;
    this.prefetchTriggers = prefetchTriggers;
    this.hydrateTriggers = hydrateTriggers;
    this.definedTriggers = Object.keys(triggers);
    this.definedPrefetchTriggers = Object.keys(prefetchTriggers);
    this.definedHydrateTriggers = Object.keys(hydrateTriggers);
  }
  visit(visitor) {
    return visitor.visitDeferredBlock(this);
  }
  visitAll(visitor) {
    this.visitTriggers(this.definedHydrateTriggers, this.hydrateTriggers, visitor);
    this.visitTriggers(this.definedTriggers, this.triggers, visitor);
    this.visitTriggers(this.definedPrefetchTriggers, this.prefetchTriggers, visitor);
    visitAll$1(visitor, this.children);
    const remainingBlocks = [this.placeholder, this.loading, this.error].filter((x) => x !== null);
    visitAll$1(visitor, remainingBlocks);
  }
  visitTriggers(keys, triggers, visitor) {
    visitAll$1(visitor, keys.map((k) => triggers[k]));
  }
}
class SwitchBlock extends BlockNode {
  expression;
  cases;
  unknownBlocks;
  constructor(expression, cases, unknownBlocks, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.expression = expression;
    this.cases = cases;
    this.unknownBlocks = unknownBlocks;
  }
  visit(visitor) {
    return visitor.visitSwitchBlock(this);
  }
}
class SwitchBlockCase extends BlockNode {
  expression;
  children;
  i18n;
  constructor(expression, children, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n2) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.expression = expression;
    this.children = children;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitSwitchBlockCase(this);
  }
}
class ForLoopBlock extends BlockNode {
  item;
  expression;
  trackBy;
  trackKeywordSpan;
  contextVariables;
  children;
  empty;
  mainBlockSpan;
  i18n;
  constructor(item, expression, trackBy, trackKeywordSpan, contextVariables, children, empty, sourceSpan, mainBlockSpan, startSourceSpan, endSourceSpan, nameSpan, i18n2) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.item = item;
    this.expression = expression;
    this.trackBy = trackBy;
    this.trackKeywordSpan = trackKeywordSpan;
    this.contextVariables = contextVariables;
    this.children = children;
    this.empty = empty;
    this.mainBlockSpan = mainBlockSpan;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitForLoopBlock(this);
  }
}
class ForLoopBlockEmpty extends BlockNode {
  children;
  i18n;
  constructor(children, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n2) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.children = children;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitForLoopBlockEmpty(this);
  }
}
class IfBlock extends BlockNode {
  branches;
  constructor(branches, sourceSpan, startSourceSpan, endSourceSpan, nameSpan) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.branches = branches;
  }
  visit(visitor) {
    return visitor.visitIfBlock(this);
  }
}
class IfBlockBranch extends BlockNode {
  expression;
  children;
  expressionAlias;
  i18n;
  constructor(expression, children, expressionAlias, sourceSpan, startSourceSpan, endSourceSpan, nameSpan, i18n2) {
    super(nameSpan, sourceSpan, startSourceSpan, endSourceSpan);
    this.expression = expression;
    this.children = children;
    this.expressionAlias = expressionAlias;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitIfBlockBranch(this);
  }
}
class UnknownBlock {
  name;
  sourceSpan;
  nameSpan;
  constructor(name, sourceSpan, nameSpan) {
    this.name = name;
    this.sourceSpan = sourceSpan;
    this.nameSpan = nameSpan;
  }
  visit(visitor) {
    return visitor.visitUnknownBlock(this);
  }
}
class LetDeclaration$1 {
  name;
  value;
  sourceSpan;
  nameSpan;
  valueSpan;
  constructor(name, value, sourceSpan, nameSpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.nameSpan = nameSpan;
    this.valueSpan = valueSpan;
  }
  visit(visitor) {
    return visitor.visitLetDeclaration(this);
  }
}
class Template {
  tagName;
  attributes;
  inputs;
  outputs;
  templateAttrs;
  children;
  references;
  variables;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  i18n;
  constructor(tagName, attributes, inputs, outputs, templateAttrs, children, references, variables, sourceSpan, startSourceSpan, endSourceSpan, i18n2) {
    this.tagName = tagName;
    this.attributes = attributes;
    this.inputs = inputs;
    this.outputs = outputs;
    this.templateAttrs = templateAttrs;
    this.children = children;
    this.references = references;
    this.variables = variables;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitTemplate(this);
  }
}
class Content {
  selector;
  attributes;
  children;
  sourceSpan;
  i18n;
  name = "ng-content";
  constructor(selector, attributes, children, sourceSpan, i18n2) {
    this.selector = selector;
    this.attributes = attributes;
    this.children = children;
    this.sourceSpan = sourceSpan;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitContent(this);
  }
}
class Variable {
  name;
  value;
  sourceSpan;
  keySpan;
  valueSpan;
  constructor(name, value, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
  }
  visit(visitor) {
    return visitor.visitVariable(this);
  }
}
class Reference {
  name;
  value;
  sourceSpan;
  keySpan;
  valueSpan;
  constructor(name, value, sourceSpan, keySpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
  }
  visit(visitor) {
    return visitor.visitReference(this);
  }
}
class Icu$1 {
  vars;
  placeholders;
  sourceSpan;
  i18n;
  constructor(vars, placeholders, sourceSpan, i18n2) {
    this.vars = vars;
    this.placeholders = placeholders;
    this.sourceSpan = sourceSpan;
    this.i18n = i18n2;
  }
  visit(visitor) {
    return visitor.visitIcu(this);
  }
}
class RecursiveVisitor$1 {
  visitElement(element2) {
    visitAll$1(this, element2.attributes);
    visitAll$1(this, element2.inputs);
    visitAll$1(this, element2.outputs);
    visitAll$1(this, element2.children);
    visitAll$1(this, element2.references);
  }
  visitTemplate(template2) {
    visitAll$1(this, template2.attributes);
    visitAll$1(this, template2.inputs);
    visitAll$1(this, template2.outputs);
    visitAll$1(this, template2.children);
    visitAll$1(this, template2.references);
    visitAll$1(this, template2.variables);
  }
  visitDeferredBlock(deferred) {
    deferred.visitAll(this);
  }
  visitDeferredBlockPlaceholder(block) {
    visitAll$1(this, block.children);
  }
  visitDeferredBlockError(block) {
    visitAll$1(this, block.children);
  }
  visitDeferredBlockLoading(block) {
    visitAll$1(this, block.children);
  }
  visitSwitchBlock(block) {
    visitAll$1(this, block.cases);
  }
  visitSwitchBlockCase(block) {
    visitAll$1(this, block.children);
  }
  visitForLoopBlock(block) {
    const blockItems = [block.item, ...block.contextVariables, ...block.children];
    block.empty && blockItems.push(block.empty);
    visitAll$1(this, blockItems);
  }
  visitForLoopBlockEmpty(block) {
    visitAll$1(this, block.children);
  }
  visitIfBlock(block) {
    visitAll$1(this, block.branches);
  }
  visitIfBlockBranch(block) {
    const blockItems = block.children;
    block.expressionAlias && blockItems.push(block.expressionAlias);
    visitAll$1(this, blockItems);
  }
  visitContent(content) {
    visitAll$1(this, content.children);
  }
  visitVariable(variable2) {
  }
  visitReference(reference2) {
  }
  visitTextAttribute(attribute2) {
  }
  visitBoundAttribute(attribute2) {
  }
  visitBoundEvent(attribute2) {
  }
  visitText(text2) {
  }
  visitBoundText(text2) {
  }
  visitIcu(icu) {
  }
  visitDeferredTrigger(trigger) {
  }
  visitUnknownBlock(block) {
  }
  visitLetDeclaration(decl) {
  }
}
function visitAll$1(visitor, nodes) {
  const result = [];
  if (visitor.visit) {
    for (const node of nodes) {
      visitor.visit(node) || node.visit(visitor);
    }
  } else {
    for (const node of nodes) {
      const newNode = node.visit(visitor);
      if (newNode) {
        result.push(newNode);
      }
    }
  }
  return result;
}
class Message {
  nodes;
  placeholders;
  placeholderToMessage;
  meaning;
  description;
  customId;
  sources;
  id;
  /** The ids to use if there are no custom id and if `i18nLegacyMessageIdFormat` is not empty */
  legacyIds = [];
  messageString;
  /**
   * @param nodes message AST
   * @param placeholders maps placeholder names to static content and their source spans
   * @param placeholderToMessage maps placeholder names to messages (used for nested ICU messages)
   * @param meaning
   * @param description
   * @param customId
   */
  constructor(nodes, placeholders, placeholderToMessage, meaning, description, customId) {
    this.nodes = nodes;
    this.placeholders = placeholders;
    this.placeholderToMessage = placeholderToMessage;
    this.meaning = meaning;
    this.description = description;
    this.customId = customId;
    this.id = this.customId;
    this.messageString = serializeMessage(this.nodes);
    if (nodes.length) {
      this.sources = [
        {
          filePath: nodes[0].sourceSpan.start.file.url,
          startLine: nodes[0].sourceSpan.start.line + 1,
          startCol: nodes[0].sourceSpan.start.col + 1,
          endLine: nodes[nodes.length - 1].sourceSpan.end.line + 1,
          endCol: nodes[0].sourceSpan.start.col + 1
        }
      ];
    } else {
      this.sources = [];
    }
  }
}
class Text$2 {
  value;
  sourceSpan;
  constructor(value, sourceSpan) {
    this.value = value;
    this.sourceSpan = sourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitText(this, context);
  }
}
class Container {
  children;
  sourceSpan;
  constructor(children, sourceSpan) {
    this.children = children;
    this.sourceSpan = sourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitContainer(this, context);
  }
}
class Icu {
  expression;
  type;
  cases;
  sourceSpan;
  expressionPlaceholder;
  constructor(expression, type, cases, sourceSpan, expressionPlaceholder) {
    this.expression = expression;
    this.type = type;
    this.cases = cases;
    this.sourceSpan = sourceSpan;
    this.expressionPlaceholder = expressionPlaceholder;
  }
  visit(visitor, context) {
    return visitor.visitIcu(this, context);
  }
}
class TagPlaceholder {
  tag;
  attrs;
  startName;
  closeName;
  children;
  isVoid;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  constructor(tag, attrs, startName, closeName, children, isVoid, sourceSpan, startSourceSpan, endSourceSpan) {
    this.tag = tag;
    this.attrs = attrs;
    this.startName = startName;
    this.closeName = closeName;
    this.children = children;
    this.isVoid = isVoid;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitTagPlaceholder(this, context);
  }
}
class Placeholder {
  value;
  name;
  sourceSpan;
  constructor(value, name, sourceSpan) {
    this.value = value;
    this.name = name;
    this.sourceSpan = sourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitPlaceholder(this, context);
  }
}
class IcuPlaceholder {
  value;
  name;
  sourceSpan;
  /** Used to capture a message computed from a previous processing pass (see `setI18nRefs()`). */
  previousMessage;
  constructor(value, name, sourceSpan) {
    this.value = value;
    this.name = name;
    this.sourceSpan = sourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitIcuPlaceholder(this, context);
  }
}
class BlockPlaceholder {
  name;
  parameters;
  startName;
  closeName;
  children;
  sourceSpan;
  startSourceSpan;
  endSourceSpan;
  constructor(name, parameters, startName, closeName, children, sourceSpan, startSourceSpan, endSourceSpan) {
    this.name = name;
    this.parameters = parameters;
    this.startName = startName;
    this.closeName = closeName;
    this.children = children;
    this.sourceSpan = sourceSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitBlockPlaceholder(this, context);
  }
}
class CloneVisitor {
  visitText(text2, context) {
    return new Text$2(text2.value, text2.sourceSpan);
  }
  visitContainer(container, context) {
    const children = container.children.map((n) => n.visit(this, context));
    return new Container(children, container.sourceSpan);
  }
  visitIcu(icu, context) {
    const cases = {};
    Object.keys(icu.cases).forEach((key) => cases[key] = icu.cases[key].visit(this, context));
    const msg = new Icu(icu.expression, icu.type, cases, icu.sourceSpan, icu.expressionPlaceholder);
    return msg;
  }
  visitTagPlaceholder(ph, context) {
    const children = ph.children.map((n) => n.visit(this, context));
    return new TagPlaceholder(ph.tag, ph.attrs, ph.startName, ph.closeName, children, ph.isVoid, ph.sourceSpan, ph.startSourceSpan, ph.endSourceSpan);
  }
  visitPlaceholder(ph, context) {
    return new Placeholder(ph.value, ph.name, ph.sourceSpan);
  }
  visitIcuPlaceholder(ph, context) {
    return new IcuPlaceholder(ph.value, ph.name, ph.sourceSpan);
  }
  visitBlockPlaceholder(ph, context) {
    const children = ph.children.map((n) => n.visit(this, context));
    return new BlockPlaceholder(ph.name, ph.parameters, ph.startName, ph.closeName, children, ph.sourceSpan, ph.startSourceSpan, ph.endSourceSpan);
  }
}
class RecurseVisitor {
  visitText(text2, context) {
  }
  visitContainer(container, context) {
    container.children.forEach((child) => child.visit(this));
  }
  visitIcu(icu, context) {
    Object.keys(icu.cases).forEach((k) => {
      icu.cases[k].visit(this);
    });
  }
  visitTagPlaceholder(ph, context) {
    ph.children.forEach((child) => child.visit(this));
  }
  visitPlaceholder(ph, context) {
  }
  visitIcuPlaceholder(ph, context) {
  }
  visitBlockPlaceholder(ph, context) {
    ph.children.forEach((child) => child.visit(this));
  }
}
function serializeMessage(messageNodes) {
  const visitor = new LocalizeMessageStringVisitor();
  const str = messageNodes.map((n) => n.visit(visitor)).join("");
  return str;
}
class LocalizeMessageStringVisitor {
  visitText(text2) {
    return text2.value;
  }
  visitContainer(container) {
    return container.children.map((child) => child.visit(this)).join("");
  }
  visitIcu(icu) {
    const strCases = Object.keys(icu.cases).map((k) => `${k} {${icu.cases[k].visit(this)}}`);
    return `{${icu.expressionPlaceholder}, ${icu.type}, ${strCases.join(" ")}}`;
  }
  visitTagPlaceholder(ph) {
    const children = ph.children.map((child) => child.visit(this)).join("");
    return `{$${ph.startName}}${children}{$${ph.closeName}}`;
  }
  visitPlaceholder(ph) {
    return `{$${ph.name}}`;
  }
  visitIcuPlaceholder(ph) {
    return `{$${ph.name}}`;
  }
  visitBlockPlaceholder(ph) {
    const children = ph.children.map((child) => child.visit(this)).join("");
    return `{$${ph.startName}}${children}{$${ph.closeName}}`;
  }
}
class Serializer {
  // Creates a name mapper, see `PlaceholderMapper`
  // Returning `null` means that no name mapping is used.
  createNameMapper(message) {
    return null;
  }
}
class SimplePlaceholderMapper extends RecurseVisitor {
  mapName;
  internalToPublic = {};
  publicToNextId = {};
  publicToInternal = {};
  // create a mapping from the message
  constructor(message, mapName) {
    super();
    this.mapName = mapName;
    message.nodes.forEach((node) => node.visit(this));
  }
  toPublicName(internalName) {
    return this.internalToPublic.hasOwnProperty(internalName) ? this.internalToPublic[internalName] : null;
  }
  toInternalName(publicName) {
    return this.publicToInternal.hasOwnProperty(publicName) ? this.publicToInternal[publicName] : null;
  }
  visitText(text2, context) {
    return null;
  }
  visitTagPlaceholder(ph, context) {
    this.visitPlaceholderName(ph.startName);
    super.visitTagPlaceholder(ph, context);
    this.visitPlaceholderName(ph.closeName);
  }
  visitPlaceholder(ph, context) {
    this.visitPlaceholderName(ph.name);
  }
  visitBlockPlaceholder(ph, context) {
    this.visitPlaceholderName(ph.startName);
    super.visitBlockPlaceholder(ph, context);
    this.visitPlaceholderName(ph.closeName);
  }
  visitIcuPlaceholder(ph, context) {
    this.visitPlaceholderName(ph.name);
  }
  // XMB placeholders could only contains A-Z, 0-9 and _
  visitPlaceholderName(internalName) {
    if (!internalName || this.internalToPublic.hasOwnProperty(internalName)) {
      return;
    }
    let publicName = this.mapName(internalName);
    if (this.publicToInternal.hasOwnProperty(publicName)) {
      const nextId = this.publicToNextId[publicName];
      this.publicToNextId[publicName] = nextId + 1;
      publicName = `${publicName}_${nextId}`;
    } else {
      this.publicToNextId[publicName] = 1;
    }
    this.internalToPublic[internalName] = publicName;
    this.publicToInternal[publicName] = internalName;
  }
}
class _Visitor$2 {
  visitTag(tag) {
    const strAttrs = this._serializeAttributes(tag.attrs);
    if (tag.children.length == 0) {
      return `<${tag.name}${strAttrs}/>`;
    }
    const strChildren = tag.children.map((node) => node.visit(this));
    return `<${tag.name}${strAttrs}>${strChildren.join("")}</${tag.name}>`;
  }
  visitText(text2) {
    return text2.value;
  }
  visitDeclaration(decl) {
    return `<?xml${this._serializeAttributes(decl.attrs)} ?>`;
  }
  _serializeAttributes(attrs) {
    const strAttrs = Object.keys(attrs).map((name) => `${name}="${attrs[name]}"`).join(" ");
    return strAttrs.length > 0 ? " " + strAttrs : "";
  }
  visitDoctype(doctype) {
    return `<!DOCTYPE ${doctype.rootTag} [
${doctype.dtd}
]>`;
  }
}
const _visitor = new _Visitor$2();
function serialize$1(nodes) {
  return nodes.map((node) => node.visit(_visitor)).join("");
}
class Declaration {
  attrs = {};
  constructor(unescapedAttrs) {
    Object.keys(unescapedAttrs).forEach((k) => {
      this.attrs[k] = escapeXml(unescapedAttrs[k]);
    });
  }
  visit(visitor) {
    return visitor.visitDeclaration(this);
  }
}
class Doctype {
  rootTag;
  dtd;
  constructor(rootTag, dtd) {
    this.rootTag = rootTag;
    this.dtd = dtd;
  }
  visit(visitor) {
    return visitor.visitDoctype(this);
  }
}
class Tag {
  name;
  children;
  attrs = {};
  constructor(name, unescapedAttrs = {}, children = []) {
    this.name = name;
    this.children = children;
    Object.keys(unescapedAttrs).forEach((k) => {
      this.attrs[k] = escapeXml(unescapedAttrs[k]);
    });
  }
  visit(visitor) {
    return visitor.visitTag(this);
  }
}
class Text$1 {
  value;
  constructor(unescapedValue) {
    this.value = escapeXml(unescapedValue);
  }
  visit(visitor) {
    return visitor.visitText(this);
  }
}
class CR extends Text$1 {
  constructor(ws = 0) {
    super(`
${new Array(ws + 1).join(" ")}`);
  }
}
const _ESCAPED_CHARS = [
  [/&/g, "&amp;"],
  [/"/g, "&quot;"],
  [/'/g, "&apos;"],
  [/</g, "&lt;"],
  [/>/g, "&gt;"]
];
function escapeXml(text2) {
  return _ESCAPED_CHARS.reduce((text3, entry) => text3.replace(entry[0], entry[1]), text2);
}
const _XMB_HANDLER = "angular";
const _MESSAGES_TAG = "messagebundle";
const _MESSAGE_TAG = "msg";
const _PLACEHOLDER_TAG$3 = "ph";
const _EXAMPLE_TAG = "ex";
const _SOURCE_TAG$2 = "source";
const _DOCTYPE = `<!ELEMENT messagebundle (msg)*>
<!ATTLIST messagebundle class CDATA #IMPLIED>

<!ELEMENT msg (#PCDATA|ph|source)*>
<!ATTLIST msg id CDATA #IMPLIED>
<!ATTLIST msg seq CDATA #IMPLIED>
<!ATTLIST msg name CDATA #IMPLIED>
<!ATTLIST msg desc CDATA #IMPLIED>
<!ATTLIST msg meaning CDATA #IMPLIED>
<!ATTLIST msg obsolete (obsolete) #IMPLIED>
<!ATTLIST msg xml:space (default|preserve) "default">
<!ATTLIST msg is_hidden CDATA #IMPLIED>

<!ELEMENT source (#PCDATA)>

<!ELEMENT ph (#PCDATA|ex)*>
<!ATTLIST ph name CDATA #REQUIRED>

<!ELEMENT ex (#PCDATA)>`;
class Xmb extends Serializer {
  write(messages, locale) {
    const exampleVisitor = new ExampleVisitor();
    const visitor = new _Visitor$1();
    const rootNode = new Tag(_MESSAGES_TAG);
    rootNode.attrs["handler"] = _XMB_HANDLER;
    messages.forEach((message) => {
      const attrs = { id: message.id };
      if (message.description) {
        attrs["desc"] = message.description;
      }
      if (message.meaning) {
        attrs["meaning"] = message.meaning;
      }
      let sourceTags = [];
      message.sources.forEach((source) => {
        sourceTags.push(new Tag(_SOURCE_TAG$2, {}, [
          new Text$1(`${source.filePath}:${source.startLine}${source.endLine !== source.startLine ? "," + source.endLine : ""}`)
        ]));
      });
      rootNode.children.push(new CR(2), new Tag(_MESSAGE_TAG, attrs, [...sourceTags, ...visitor.serialize(message.nodes)]));
    });
    rootNode.children.push(new CR());
    return serialize$1([
      new Declaration({ version: "1.0", encoding: "UTF-8" }),
      new CR(),
      new Doctype(_MESSAGES_TAG, _DOCTYPE),
      new CR(),
      exampleVisitor.addDefaultExamples(rootNode),
      new CR()
    ]);
  }
  load(content, url) {
    throw new Error("Unsupported");
  }
  digest(message) {
    return digest(message);
  }
  createNameMapper(message) {
    return new SimplePlaceholderMapper(message, toPublicName);
  }
}
class _Visitor$1 {
  visitText(text2, context) {
    return [new Text$1(text2.value)];
  }
  visitContainer(container, context) {
    const nodes = [];
    container.children.forEach((node) => nodes.push(...node.visit(this)));
    return nodes;
  }
  visitIcu(icu, context) {
    const nodes = [new Text$1(`{${icu.expressionPlaceholder}, ${icu.type}, `)];
    Object.keys(icu.cases).forEach((c) => {
      nodes.push(new Text$1(`${c} {`), ...icu.cases[c].visit(this), new Text$1(`} `));
    });
    nodes.push(new Text$1(`}`));
    return nodes;
  }
  visitTagPlaceholder(ph, context) {
    const startTagAsText = new Text$1(`<${ph.tag}>`);
    const startEx = new Tag(_EXAMPLE_TAG, {}, [startTagAsText]);
    const startTagPh = new Tag(_PLACEHOLDER_TAG$3, { name: ph.startName }, [
      startEx,
      startTagAsText
    ]);
    if (ph.isVoid) {
      return [startTagPh];
    }
    const closeTagAsText = new Text$1(`</${ph.tag}>`);
    const closeEx = new Tag(_EXAMPLE_TAG, {}, [closeTagAsText]);
    const closeTagPh = new Tag(_PLACEHOLDER_TAG$3, { name: ph.closeName }, [
      closeEx,
      closeTagAsText
    ]);
    return [startTagPh, ...this.serialize(ph.children), closeTagPh];
  }
  visitPlaceholder(ph, context) {
    const interpolationAsText = new Text$1(`{{${ph.value}}}`);
    const exTag = new Tag(_EXAMPLE_TAG, {}, [interpolationAsText]);
    return [
      // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
      new Tag(_PLACEHOLDER_TAG$3, { name: ph.name }, [exTag, interpolationAsText])
    ];
  }
  visitBlockPlaceholder(ph, context) {
    const startAsText = new Text$1(`@${ph.name}`);
    const startEx = new Tag(_EXAMPLE_TAG, {}, [startAsText]);
    const startTagPh = new Tag(_PLACEHOLDER_TAG$3, { name: ph.startName }, [startEx, startAsText]);
    const closeAsText = new Text$1(`}`);
    const closeEx = new Tag(_EXAMPLE_TAG, {}, [closeAsText]);
    const closeTagPh = new Tag(_PLACEHOLDER_TAG$3, { name: ph.closeName }, [closeEx, closeAsText]);
    return [startTagPh, ...this.serialize(ph.children), closeTagPh];
  }
  visitIcuPlaceholder(ph, context) {
    const icuExpression = ph.value.expression;
    const icuType = ph.value.type;
    const icuCases = Object.keys(ph.value.cases).map((value) => value + " {...}").join(" ");
    const icuAsText = new Text$1(`{${icuExpression}, ${icuType}, ${icuCases}}`);
    const exTag = new Tag(_EXAMPLE_TAG, {}, [icuAsText]);
    return [
      // TC requires PH to have a non empty EX, and uses the text node to show the "original" value.
      new Tag(_PLACEHOLDER_TAG$3, { name: ph.name }, [exTag, icuAsText])
    ];
  }
  serialize(nodes) {
    return [].concat(...nodes.map((node) => node.visit(this)));
  }
}
function digest(message) {
  return decimalDigest(message);
}
class ExampleVisitor {
  addDefaultExamples(node) {
    node.visit(this);
    return node;
  }
  visitTag(tag) {
    if (tag.name === _PLACEHOLDER_TAG$3) {
      if (!tag.children || tag.children.length == 0) {
        const exText = new Text$1(tag.attrs["name"] || "...");
        tag.children = [new Tag(_EXAMPLE_TAG, {}, [exText])];
      }
    } else if (tag.children) {
      tag.children.forEach((node) => node.visit(this));
    }
  }
  visitText(text2) {
  }
  visitDeclaration(decl) {
  }
  visitDoctype(doctype) {
  }
}
function toPublicName(internalName) {
  return internalName.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
}
const I18N_ATTR = "i18n";
const I18N_ATTR_PREFIX = "i18n-";
const I18N_ICU_VAR_PREFIX = "VAR_";
function isI18nAttribute(name) {
  return name === I18N_ATTR || name.startsWith(I18N_ATTR_PREFIX);
}
function hasI18nAttrs(element2) {
  return element2.attrs.some((attr) => isI18nAttribute(attr.name));
}
function icuFromI18nMessage(message) {
  return message.nodes[0];
}
function formatI18nPlaceholderNamesInMap(params = {}, useCamelCase) {
  const _params = {};
  if (params && Object.keys(params).length) {
    Object.keys(params).forEach((key) => _params[formatI18nPlaceholderName(key, useCamelCase)] = params[key]);
  }
  return _params;
}
function formatI18nPlaceholderName(name, useCamelCase = true) {
  const publicName = toPublicName(name);
  if (!useCamelCase) {
    return publicName;
  }
  const chunks = publicName.split("_");
  if (chunks.length === 1) {
    return name.toLowerCase();
  }
  let postfix;
  if (/^\d+$/.test(chunks[chunks.length - 1])) {
    postfix = chunks.pop();
  }
  let raw = chunks.shift().toLowerCase();
  if (chunks.length) {
    raw += chunks.map((c) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()).join("");
  }
  return postfix ? `${raw}_${postfix}` : raw;
}
const UNSAFE_OBJECT_KEY_NAME_REGEXP = /[-.]/;
const TEMPORARY_NAME = "_t";
const CONTEXT_NAME = "ctx";
const RENDER_FLAGS = "rf";
function temporaryAllocator(pushStatement, name) {
  let temp = null;
  return () => {
    if (!temp) {
      pushStatement(new DeclareVarStmt(TEMPORARY_NAME, void 0, DYNAMIC_TYPE));
      temp = variable(name);
    }
    return temp;
  };
}
function asLiteral(value) {
  if (Array.isArray(value)) {
    return literalArr(value.map(asLiteral));
  }
  return literal(value, INFERRED_TYPE);
}
function conditionallyCreateDirectiveBindingLiteral(map, forInputs) {
  const keys = Object.getOwnPropertyNames(map);
  if (keys.length === 0) {
    return null;
  }
  return literalMap(keys.map((key) => {
    const value = map[key];
    let declaredName;
    let publicName;
    let minifiedName;
    let expressionValue;
    if (typeof value === "string") {
      declaredName = key;
      minifiedName = key;
      publicName = value;
      expressionValue = asLiteral(publicName);
    } else {
      minifiedName = key;
      declaredName = value.classPropertyName;
      publicName = value.bindingPropertyName;
      const differentDeclaringName = publicName !== declaredName;
      const hasDecoratorInputTransform = value.transformFunction !== null;
      let flags = InputFlags.None;
      if (value.isSignal) {
        flags |= InputFlags.SignalBased;
      }
      if (hasDecoratorInputTransform) {
        flags |= InputFlags.HasDecoratorInputTransform;
      }
      if (forInputs && (differentDeclaringName || hasDecoratorInputTransform || flags !== InputFlags.None)) {
        const result = [literal(flags), asLiteral(publicName)];
        if (differentDeclaringName || hasDecoratorInputTransform) {
          result.push(asLiteral(declaredName));
          if (hasDecoratorInputTransform) {
            result.push(value.transformFunction);
          }
        }
        expressionValue = literalArr(result);
      } else {
        expressionValue = asLiteral(publicName);
      }
    }
    return {
      key: minifiedName,
      // put quotes around keys that contain potentially unsafe characters
      quoted: UNSAFE_OBJECT_KEY_NAME_REGEXP.test(minifiedName),
      value: expressionValue
    };
  }));
}
class DefinitionMap {
  values = [];
  set(key, value) {
    if (value) {
      const existing = this.values.find((value2) => value2.key === key);
      if (existing) {
        existing.value = value;
      } else {
        this.values.push({ key, value, quoted: false });
      }
    }
  }
  toLiteralMap() {
    return literalMap(this.values);
  }
}
function createCssSelectorFromNode(node) {
  const elementName = node instanceof Element$1 ? node.name : "ng-template";
  const attributes = getAttrsForDirectiveMatching(node);
  const cssSelector = new CssSelector();
  const elementNameNoNs = splitNsName(elementName)[1];
  cssSelector.setElement(elementNameNoNs);
  Object.getOwnPropertyNames(attributes).forEach((name) => {
    const nameNoNs = splitNsName(name)[1];
    const value = attributes[name];
    cssSelector.addAttribute(nameNoNs, value);
    if (name.toLowerCase() === "class") {
      const classes = value.trim().split(/\s+/);
      classes.forEach((className) => cssSelector.addClassName(className));
    }
  });
  return cssSelector;
}
function getAttrsForDirectiveMatching(elOrTpl) {
  const attributesMap = {};
  if (elOrTpl instanceof Template && elOrTpl.tagName !== "ng-template") {
    elOrTpl.templateAttrs.forEach((a) => attributesMap[a.name] = "");
  } else {
    elOrTpl.attributes.forEach((a) => {
      if (!isI18nAttribute(a.name)) {
        attributesMap[a.name] = a.value;
      }
    });
    elOrTpl.inputs.forEach((i) => {
      if (i.type === BindingType.Property || i.type === BindingType.TwoWay) {
        attributesMap[i.name] = "";
      }
    });
    elOrTpl.outputs.forEach((o) => {
      attributesMap[o.name] = "";
    });
  }
  return attributesMap;
}
function compileInjectable(meta, resolveForwardRefs) {
  let result = null;
  const factoryMeta = {
    name: meta.name,
    type: meta.type,
    typeArgumentCount: meta.typeArgumentCount,
    deps: [],
    target: FactoryTarget$1.Injectable
  };
  if (meta.useClass !== void 0) {
    const useClassOnSelf = meta.useClass.expression.isEquivalent(meta.type.value);
    let deps = void 0;
    if (meta.deps !== void 0) {
      deps = meta.deps;
    }
    if (deps !== void 0) {
      result = compileFactoryFunction({
        ...factoryMeta,
        delegate: meta.useClass.expression,
        delegateDeps: deps,
        delegateType: R3FactoryDelegateType.Class
      });
    } else if (useClassOnSelf) {
      result = compileFactoryFunction(factoryMeta);
    } else {
      result = {
        statements: [],
        expression: delegateToFactory(meta.type.value, meta.useClass.expression, resolveForwardRefs)
      };
    }
  } else if (meta.useFactory !== void 0) {
    if (meta.deps !== void 0) {
      result = compileFactoryFunction({
        ...factoryMeta,
        delegate: meta.useFactory,
        delegateDeps: meta.deps || [],
        delegateType: R3FactoryDelegateType.Function
      });
    } else {
      result = { statements: [], expression: arrowFn([], meta.useFactory.callFn([])) };
    }
  } else if (meta.useValue !== void 0) {
    result = compileFactoryFunction({
      ...factoryMeta,
      expression: meta.useValue.expression
    });
  } else if (meta.useExisting !== void 0) {
    result = compileFactoryFunction({
      ...factoryMeta,
      expression: importExpr(Identifiers.inject).callFn([meta.useExisting.expression])
    });
  } else {
    result = {
      statements: [],
      expression: delegateToFactory(meta.type.value, meta.type.value, resolveForwardRefs)
    };
  }
  const token = meta.type.value;
  const injectableProps = new DefinitionMap();
  injectableProps.set("token", token);
  injectableProps.set("factory", result.expression);
  if (meta.providedIn.expression.value !== null) {
    injectableProps.set("providedIn", convertFromMaybeForwardRefExpression(meta.providedIn));
  }
  const expression = importExpr(Identifiers.ɵɵdefineInjectable).callFn([injectableProps.toLiteralMap()], void 0, true);
  return {
    expression,
    type: createInjectableType(meta),
    statements: result.statements
  };
}
function createInjectableType(meta) {
  return new ExpressionType(importExpr(Identifiers.InjectableDeclaration, [
    typeWithParameters(meta.type.type, meta.typeArgumentCount)
  ]));
}
function delegateToFactory(type, useType, unwrapForwardRefs) {
  if (type.node === useType.node) {
    return useType.prop("ɵfac");
  }
  if (!unwrapForwardRefs) {
    return createFactoryFunction(useType);
  }
  const unwrappedType = importExpr(Identifiers.resolveForwardRef).callFn([useType]);
  return createFactoryFunction(unwrappedType);
}
function createFactoryFunction(type) {
  const t = new FnParam("__ngFactoryType__", DYNAMIC_TYPE);
  return arrowFn([t], type.prop("ɵfac").callFn([variable(t.name)]));
}
const UNUSABLE_INTERPOLATION_REGEXPS = [
  /@/,
  // control flow reserved symbol
  /^\s*$/,
  // empty
  /[<>]/,
  // html tag
  /^[{}]$/,
  // i18n expansion
  /&(#|[a-z])/i,
  // character reference,
  /^\/\//
  // comment
];
function assertInterpolationSymbols(identifier, value) {
  if (value != null && !(Array.isArray(value) && value.length == 2)) {
    throw new Error(`Expected '${identifier}' to be an array, [start, end].`);
  } else if (value != null) {
    const start = value[0];
    const end = value[1];
    UNUSABLE_INTERPOLATION_REGEXPS.forEach((regexp) => {
      if (regexp.test(start) || regexp.test(end)) {
        throw new Error(`['${start}', '${end}'] contains unusable interpolation symbol.`);
      }
    });
  }
}
class InterpolationConfig {
  start;
  end;
  static fromArray(markers) {
    if (!markers) {
      return DEFAULT_INTERPOLATION_CONFIG;
    }
    assertInterpolationSymbols("interpolation", markers);
    return new InterpolationConfig(markers[0], markers[1]);
  }
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}
const DEFAULT_INTERPOLATION_CONFIG = new InterpolationConfig("{{", "}}");
const DEFAULT_CONTAINER_BLOCKS = /* @__PURE__ */ new Set(["switch"]);
const $EOF = 0;
const $BSPACE = 8;
const $TAB = 9;
const $LF = 10;
const $VTAB = 11;
const $FF = 12;
const $CR = 13;
const $SPACE = 32;
const $BANG = 33;
const $DQ = 34;
const $HASH = 35;
const $$ = 36;
const $PERCENT = 37;
const $AMPERSAND = 38;
const $SQ = 39;
const $LPAREN = 40;
const $RPAREN = 41;
const $STAR = 42;
const $PLUS = 43;
const $COMMA = 44;
const $MINUS = 45;
const $PERIOD = 46;
const $SLASH = 47;
const $COLON = 58;
const $SEMICOLON = 59;
const $LT = 60;
const $EQ = 61;
const $GT = 62;
const $QUESTION = 63;
const $0 = 48;
const $7 = 55;
const $9 = 57;
const $A = 65;
const $E = 69;
const $F = 70;
const $X = 88;
const $Z = 90;
const $LBRACKET = 91;
const $BACKSLASH = 92;
const $RBRACKET = 93;
const $CARET = 94;
const $_ = 95;
const $a = 97;
const $b = 98;
const $e = 101;
const $f = 102;
const $n = 110;
const $r = 114;
const $t = 116;
const $u = 117;
const $v = 118;
const $x = 120;
const $z = 122;
const $LBRACE = 123;
const $BAR = 124;
const $RBRACE = 125;
const $NBSP = 160;
const $AT = 64;
const $BT = 96;
function isWhitespace(code) {
  return code >= $TAB && code <= $SPACE || code == $NBSP;
}
function isDigit(code) {
  return $0 <= code && code <= $9;
}
function isAsciiLetter(code) {
  return code >= $a && code <= $z || code >= $A && code <= $Z;
}
function isAsciiHexDigit(code) {
  return code >= $a && code <= $f || code >= $A && code <= $F || isDigit(code);
}
function isNewLine(code) {
  return code === $LF || code === $CR;
}
function isOctalDigit(code) {
  return $0 <= code && code <= $7;
}
function isQuote(code) {
  return code === $SQ || code === $DQ || code === $BT;
}
class ParseLocation {
  file;
  offset;
  line;
  col;
  constructor(file, offset, line, col) {
    this.file = file;
    this.offset = offset;
    this.line = line;
    this.col = col;
  }
  toString() {
    return this.offset != null ? `${this.file.url}@${this.line}:${this.col}` : this.file.url;
  }
  moveBy(delta) {
    const source = this.file.content;
    const len = source.length;
    let offset = this.offset;
    let line = this.line;
    let col = this.col;
    while (offset > 0 && delta < 0) {
      offset--;
      delta++;
      const ch = source.charCodeAt(offset);
      if (ch == $LF) {
        line--;
        const priorLine = source.substring(0, offset - 1).lastIndexOf(String.fromCharCode($LF));
        col = priorLine > 0 ? offset - priorLine : offset;
      } else {
        col--;
      }
    }
    while (offset < len && delta > 0) {
      const ch = source.charCodeAt(offset);
      offset++;
      delta--;
      if (ch == $LF) {
        line++;
        col = 0;
      } else {
        col++;
      }
    }
    return new ParseLocation(this.file, offset, line, col);
  }
  // Return the source around the location
  // Up to `maxChars` or `maxLines` on each side of the location
  getContext(maxChars, maxLines) {
    const content = this.file.content;
    let startOffset = this.offset;
    if (startOffset != null) {
      if (startOffset > content.length - 1) {
        startOffset = content.length - 1;
      }
      let endOffset = startOffset;
      let ctxChars = 0;
      let ctxLines = 0;
      while (ctxChars < maxChars && startOffset > 0) {
        startOffset--;
        ctxChars++;
        if (content[startOffset] == "\n") {
          if (++ctxLines == maxLines) {
            break;
          }
        }
      }
      ctxChars = 0;
      ctxLines = 0;
      while (ctxChars < maxChars && endOffset < content.length - 1) {
        endOffset++;
        ctxChars++;
        if (content[endOffset] == "\n") {
          if (++ctxLines == maxLines) {
            break;
          }
        }
      }
      return {
        before: content.substring(startOffset, this.offset),
        after: content.substring(this.offset, endOffset + 1)
      };
    }
    return null;
  }
}
class ParseSourceFile {
  content;
  url;
  constructor(content, url) {
    this.content = content;
    this.url = url;
  }
}
class ParseSourceSpan {
  start;
  end;
  fullStart;
  details;
  /**
   * Create an object that holds information about spans of tokens/nodes captured during
   * lexing/parsing of text.
   *
   * @param start
   * The location of the start of the span (having skipped leading trivia).
   * Skipping leading trivia makes source-spans more "user friendly", since things like HTML
   * elements will appear to begin at the start of the opening tag, rather than at the start of any
   * leading trivia, which could include newlines.
   *
   * @param end
   * The location of the end of the span.
   *
   * @param fullStart
   * The start of the token without skipping the leading trivia.
   * This is used by tooling that splits tokens further, such as extracting Angular interpolations
   * from text tokens. Such tooling creates new source-spans relative to the original token's
   * source-span. If leading trivia characters have been skipped then the new source-spans may be
   * incorrectly offset.
   *
   * @param details
   * Additional information (such as identifier names) that should be associated with the span.
   */
  constructor(start, end, fullStart = start, details = null) {
    this.start = start;
    this.end = end;
    this.fullStart = fullStart;
    this.details = details;
  }
  toString() {
    return this.start.file.content.substring(this.start.offset, this.end.offset);
  }
}
var ParseErrorLevel;
(function(ParseErrorLevel2) {
  ParseErrorLevel2[ParseErrorLevel2["WARNING"] = 0] = "WARNING";
  ParseErrorLevel2[ParseErrorLevel2["ERROR"] = 1] = "ERROR";
})(ParseErrorLevel || (ParseErrorLevel = {}));
class ParseError {
  span;
  msg;
  level;
  relatedError;
  constructor(span, msg, level = ParseErrorLevel.ERROR, relatedError) {
    this.span = span;
    this.msg = msg;
    this.level = level;
    this.relatedError = relatedError;
  }
  contextualMessage() {
    const ctx = this.span.start.getContext(100, 3);
    return ctx ? `${this.msg} ("${ctx.before}[${ParseErrorLevel[this.level]} ->]${ctx.after}")` : this.msg;
  }
  toString() {
    const details = this.span.details ? `, ${this.span.details}` : "";
    return `${this.contextualMessage()}: ${this.span.start}${details}`;
  }
}
function r3JitTypeSourceSpan(kind, typeName, sourceUrl) {
  const sourceFileName = `in ${kind} ${typeName} in ${sourceUrl}`;
  const sourceFile = new ParseSourceFile("", sourceFileName);
  return new ParseSourceSpan(new ParseLocation(sourceFile, -1, -1, -1), new ParseLocation(sourceFile, -1, -1, -1));
}
let _anonymousTypeIndex = 0;
function identifierName(compileIdentifier) {
  if (!compileIdentifier || !compileIdentifier.reference) {
    return null;
  }
  const ref = compileIdentifier.reference;
  if (ref["__anonymousType"]) {
    return ref["__anonymousType"];
  }
  if (ref["__forward_ref__"]) {
    return "__forward_ref__";
  }
  let identifier = stringify(ref);
  if (identifier.indexOf("(") >= 0) {
    identifier = `anonymous_${_anonymousTypeIndex++}`;
    ref["__anonymousType"] = identifier;
  } else {
    identifier = sanitizeIdentifier(identifier);
  }
  return identifier;
}
function sanitizeIdentifier(name) {
  return name.replace(/\W/g, "_");
}
const makeTemplateObjectPolyfill = '(this&&this.__makeTemplateObject||function(e,t){return Object.defineProperty?Object.defineProperty(e,"raw",{value:t}):e.raw=t,e})';
class AbstractJsEmitterVisitor extends AbstractEmitterVisitor {
  constructor() {
    super(false);
  }
  visitWrappedNodeExpr(ast, ctx) {
    throw new Error("Cannot emit a WrappedNodeExpr in Javascript.");
  }
  visitDeclareVarStmt(stmt, ctx) {
    ctx.print(stmt, `var ${stmt.name}`);
    if (stmt.value) {
      ctx.print(stmt, " = ");
      stmt.value.visitExpression(this, ctx);
    }
    ctx.println(stmt, `;`);
    return null;
  }
  visitTaggedTemplateExpr(ast, ctx) {
    const elements = ast.template.elements;
    ast.tag.visitExpression(this, ctx);
    ctx.print(ast, `(${makeTemplateObjectPolyfill}(`);
    ctx.print(ast, `[${elements.map((part) => escapeIdentifier(part.text, false)).join(", ")}], `);
    ctx.print(ast, `[${elements.map((part) => escapeIdentifier(part.rawText, false)).join(", ")}])`);
    ast.template.expressions.forEach((expression) => {
      ctx.print(ast, ", ");
      expression.visitExpression(this, ctx);
    });
    ctx.print(ast, ")");
    return null;
  }
  visitFunctionExpr(ast, ctx) {
    ctx.print(ast, `function${ast.name ? " " + ast.name : ""}(`);
    this._visitParams(ast.params, ctx);
    ctx.println(ast, `) {`);
    ctx.incIndent();
    this.visitAllStatements(ast.statements, ctx);
    ctx.decIndent();
    ctx.print(ast, `}`);
    return null;
  }
  visitArrowFunctionExpr(ast, ctx) {
    ctx.print(ast, "(");
    this._visitParams(ast.params, ctx);
    ctx.print(ast, ") =>");
    if (Array.isArray(ast.body)) {
      ctx.println(ast, `{`);
      ctx.incIndent();
      this.visitAllStatements(ast.body, ctx);
      ctx.decIndent();
      ctx.print(ast, `}`);
    } else {
      const isObjectLiteral = ast.body instanceof LiteralMapExpr;
      if (isObjectLiteral) {
        ctx.print(ast, "(");
      }
      ast.body.visitExpression(this, ctx);
      if (isObjectLiteral) {
        ctx.print(ast, ")");
      }
    }
    return null;
  }
  visitDeclareFunctionStmt(stmt, ctx) {
    ctx.print(stmt, `function ${stmt.name}(`);
    this._visitParams(stmt.params, ctx);
    ctx.println(stmt, `) {`);
    ctx.incIndent();
    this.visitAllStatements(stmt.statements, ctx);
    ctx.decIndent();
    ctx.println(stmt, `}`);
    return null;
  }
  visitLocalizedString(ast, ctx) {
    ctx.print(ast, `$localize(${makeTemplateObjectPolyfill}(`);
    const parts = [ast.serializeI18nHead()];
    for (let i = 1; i < ast.messageParts.length; i++) {
      parts.push(ast.serializeI18nTemplatePart(i));
    }
    ctx.print(ast, `[${parts.map((part) => escapeIdentifier(part.cooked, false)).join(", ")}], `);
    ctx.print(ast, `[${parts.map((part) => escapeIdentifier(part.raw, false)).join(", ")}])`);
    ast.expressions.forEach((expression) => {
      ctx.print(ast, ", ");
      expression.visitExpression(this, ctx);
    });
    ctx.print(ast, ")");
    return null;
  }
  _visitParams(params, ctx) {
    this.visitAllObjects((param) => ctx.print(null, param.name), params, ctx, ",");
  }
}
let policy;
function getPolicy() {
  if (policy === void 0) {
    const trustedTypes = _global["trustedTypes"];
    policy = null;
    if (trustedTypes) {
      try {
        policy = trustedTypes.createPolicy("angular#unsafe-jit", {
          createScript: (s) => s
        });
      } catch {
      }
    }
  }
  return policy;
}
function trustedScriptFromString(script) {
  return getPolicy()?.createScript(script) || script;
}
function newTrustedFunctionForJIT(...args) {
  if (!_global["trustedTypes"]) {
    return new Function(...args);
  }
  const fnArgs = args.slice(0, -1).join(",");
  const fnBody = args[args.length - 1];
  const body = `(function anonymous(${fnArgs}
) { ${fnBody}
})`;
  const fn2 = _global["eval"](trustedScriptFromString(body));
  if (fn2.bind === void 0) {
    return new Function(...args);
  }
  fn2.toString = () => body;
  return fn2.bind(_global);
}
class JitEvaluator {
  /**
   *
   * @param sourceUrl The URL of the generated code.
   * @param statements An array of Angular statement AST nodes to be evaluated.
   * @param refResolver Resolves `o.ExternalReference`s into values.
   * @param createSourceMaps If true then create a source-map for the generated code and include it
   * inline as a source-map comment.
   * @returns A map of all the variables in the generated code.
   */
  evaluateStatements(sourceUrl, statements, refResolver, createSourceMaps) {
    const converter = new JitEmitterVisitor(refResolver);
    const ctx = EmitterVisitorContext.createRoot();
    if (statements.length > 0 && !isUseStrictStatement(statements[0])) {
      statements = [literal("use strict").toStmt(), ...statements];
    }
    converter.visitAllStatements(statements, ctx);
    converter.createReturnStmt(ctx);
    return this.evaluateCode(sourceUrl, ctx, converter.getArgs(), createSourceMaps);
  }
  /**
   * Evaluate a piece of JIT generated code.
   * @param sourceUrl The URL of this generated code.
   * @param ctx A context object that contains an AST of the code to be evaluated.
   * @param vars A map containing the names and values of variables that the evaluated code might
   * reference.
   * @param createSourceMap If true then create a source-map for the generated code and include it
   * inline as a source-map comment.
   * @returns The result of evaluating the code.
   */
  evaluateCode(sourceUrl, ctx, vars, createSourceMap) {
    let fnBody = `"use strict";${ctx.toSource()}
//# sourceURL=${sourceUrl}`;
    const fnArgNames = [];
    const fnArgValues = [];
    for (const argName in vars) {
      fnArgValues.push(vars[argName]);
      fnArgNames.push(argName);
    }
    if (createSourceMap) {
      const emptyFn = newTrustedFunctionForJIT(...fnArgNames.concat("return null;")).toString();
      const headerLines = emptyFn.slice(0, emptyFn.indexOf("return null;")).split("\n").length - 1;
      fnBody += `
${ctx.toSourceMapGenerator(sourceUrl, headerLines).toJsComment()}`;
    }
    const fn2 = newTrustedFunctionForJIT(...fnArgNames.concat(fnBody));
    return this.executeFunction(fn2, fnArgValues);
  }
  /**
   * Execute a JIT generated function by calling it.
   *
   * This method can be overridden in tests to capture the functions that are generated
   * by this `JitEvaluator` class.
   *
   * @param fn A function to execute.
   * @param args The arguments to pass to the function being executed.
   * @returns The return value of the executed function.
   */
  executeFunction(fn2, args) {
    return fn2(...args);
  }
}
class JitEmitterVisitor extends AbstractJsEmitterVisitor {
  refResolver;
  _evalArgNames = [];
  _evalArgValues = [];
  _evalExportedVars = [];
  constructor(refResolver) {
    super();
    this.refResolver = refResolver;
  }
  createReturnStmt(ctx) {
    const stmt = new ReturnStatement(new LiteralMapExpr(this._evalExportedVars.map((resultVar) => new LiteralMapEntry(resultVar, variable(resultVar), false))));
    stmt.visitStatement(this, ctx);
  }
  getArgs() {
    const result = {};
    for (let i = 0; i < this._evalArgNames.length; i++) {
      result[this._evalArgNames[i]] = this._evalArgValues[i];
    }
    return result;
  }
  visitExternalExpr(ast, ctx) {
    this._emitReferenceToExternal(ast, this.refResolver.resolveExternalReference(ast.value), ctx);
    return null;
  }
  visitWrappedNodeExpr(ast, ctx) {
    this._emitReferenceToExternal(ast, ast.node, ctx);
    return null;
  }
  visitDeclareVarStmt(stmt, ctx) {
    if (stmt.hasModifier(StmtModifier.Exported)) {
      this._evalExportedVars.push(stmt.name);
    }
    return super.visitDeclareVarStmt(stmt, ctx);
  }
  visitDeclareFunctionStmt(stmt, ctx) {
    if (stmt.hasModifier(StmtModifier.Exported)) {
      this._evalExportedVars.push(stmt.name);
    }
    return super.visitDeclareFunctionStmt(stmt, ctx);
  }
  _emitReferenceToExternal(ast, value, ctx) {
    let id = this._evalArgValues.indexOf(value);
    if (id === -1) {
      id = this._evalArgValues.length;
      this._evalArgValues.push(value);
      const name = identifierName({ reference: value }) || "val";
      this._evalArgNames.push(`jit_${name}_${id}`);
    }
    ctx.print(ast, this._evalArgNames[id]);
  }
}
function isUseStrictStatement(statement) {
  return statement.isEquivalent(literal("use strict").toStmt());
}
function compileInjector(meta) {
  const definitionMap = new DefinitionMap();
  if (meta.providers !== null) {
    definitionMap.set("providers", meta.providers);
  }
  if (meta.imports.length > 0) {
    definitionMap.set("imports", literalArr(meta.imports));
  }
  const expression = importExpr(Identifiers.defineInjector).callFn([definitionMap.toLiteralMap()], void 0, true);
  const type = createInjectorType(meta);
  return { expression, type, statements: [] };
}
function createInjectorType(meta) {
  return new ExpressionType(importExpr(Identifiers.InjectorDeclaration, [new ExpressionType(meta.type.type)]));
}
class R3JitReflector {
  context;
  constructor(context) {
    this.context = context;
  }
  resolveExternalReference(ref) {
    if (ref.moduleName !== "@angular/core") {
      throw new Error(`Cannot resolve external reference to ${ref.moduleName}, only references to @angular/core are supported.`);
    }
    if (!this.context.hasOwnProperty(ref.name)) {
      throw new Error(`No value provided for @angular/core symbol '${ref.name}'.`);
    }
    return this.context[ref.name];
  }
}
var R3SelectorScopeMode;
(function(R3SelectorScopeMode2) {
  R3SelectorScopeMode2[R3SelectorScopeMode2["Inline"] = 0] = "Inline";
  R3SelectorScopeMode2[R3SelectorScopeMode2["SideEffect"] = 1] = "SideEffect";
  R3SelectorScopeMode2[R3SelectorScopeMode2["Omit"] = 2] = "Omit";
})(R3SelectorScopeMode || (R3SelectorScopeMode = {}));
var R3NgModuleMetadataKind;
(function(R3NgModuleMetadataKind2) {
  R3NgModuleMetadataKind2[R3NgModuleMetadataKind2["Global"] = 0] = "Global";
  R3NgModuleMetadataKind2[R3NgModuleMetadataKind2["Local"] = 1] = "Local";
})(R3NgModuleMetadataKind || (R3NgModuleMetadataKind = {}));
function compileNgModule(meta) {
  const statements = [];
  const definitionMap = new DefinitionMap();
  definitionMap.set("type", meta.type.value);
  if (meta.kind === R3NgModuleMetadataKind.Global && meta.bootstrap.length > 0) {
    definitionMap.set("bootstrap", refsToArray(meta.bootstrap, meta.containsForwardDecls));
  }
  if (meta.selectorScopeMode === R3SelectorScopeMode.Inline) {
    if (meta.declarations.length > 0) {
      definitionMap.set("declarations", refsToArray(meta.declarations, meta.containsForwardDecls));
    }
    if (meta.imports.length > 0) {
      definitionMap.set("imports", refsToArray(meta.imports, meta.containsForwardDecls));
    }
    if (meta.exports.length > 0) {
      definitionMap.set("exports", refsToArray(meta.exports, meta.containsForwardDecls));
    }
  } else if (meta.selectorScopeMode === R3SelectorScopeMode.SideEffect) {
    const setNgModuleScopeCall = generateSetNgModuleScopeCall(meta);
    if (setNgModuleScopeCall !== null) {
      statements.push(setNgModuleScopeCall);
    }
  } else ;
  if (meta.schemas !== null && meta.schemas.length > 0) {
    definitionMap.set("schemas", literalArr(meta.schemas.map((ref) => ref.value)));
  }
  if (meta.id !== null) {
    definitionMap.set("id", meta.id);
    statements.push(importExpr(Identifiers.registerNgModuleType).callFn([meta.type.value, meta.id]).toStmt());
  }
  const expression = importExpr(Identifiers.defineNgModule).callFn([definitionMap.toLiteralMap()], void 0, true);
  const type = createNgModuleType(meta);
  return { expression, type, statements };
}
function compileNgModuleDeclarationExpression(meta) {
  const definitionMap = new DefinitionMap();
  definitionMap.set("type", new WrappedNodeExpr(meta.type));
  if (meta.bootstrap !== void 0) {
    definitionMap.set("bootstrap", new WrappedNodeExpr(meta.bootstrap));
  }
  if (meta.declarations !== void 0) {
    definitionMap.set("declarations", new WrappedNodeExpr(meta.declarations));
  }
  if (meta.imports !== void 0) {
    definitionMap.set("imports", new WrappedNodeExpr(meta.imports));
  }
  if (meta.exports !== void 0) {
    definitionMap.set("exports", new WrappedNodeExpr(meta.exports));
  }
  if (meta.schemas !== void 0) {
    definitionMap.set("schemas", new WrappedNodeExpr(meta.schemas));
  }
  if (meta.id !== void 0) {
    definitionMap.set("id", new WrappedNodeExpr(meta.id));
  }
  return importExpr(Identifiers.defineNgModule).callFn([definitionMap.toLiteralMap()]);
}
function createNgModuleType(meta) {
  if (meta.kind === R3NgModuleMetadataKind.Local) {
    return new ExpressionType(meta.type.value);
  }
  const { type: moduleType, declarations, exports, imports, includeImportTypes, publicDeclarationTypes } = meta;
  return new ExpressionType(importExpr(Identifiers.NgModuleDeclaration, [
    new ExpressionType(moduleType.type),
    publicDeclarationTypes === null ? tupleTypeOf(declarations) : tupleOfTypes(publicDeclarationTypes),
    includeImportTypes ? tupleTypeOf(imports) : NONE_TYPE,
    tupleTypeOf(exports)
  ]));
}
function generateSetNgModuleScopeCall(meta) {
  const scopeMap = new DefinitionMap();
  if (meta.kind === R3NgModuleMetadataKind.Global) {
    if (meta.declarations.length > 0) {
      scopeMap.set("declarations", refsToArray(meta.declarations, meta.containsForwardDecls));
    }
  } else {
    if (meta.declarationsExpression) {
      scopeMap.set("declarations", meta.declarationsExpression);
    }
  }
  if (meta.kind === R3NgModuleMetadataKind.Global) {
    if (meta.imports.length > 0) {
      scopeMap.set("imports", refsToArray(meta.imports, meta.containsForwardDecls));
    }
  } else {
    if (meta.importsExpression) {
      scopeMap.set("imports", meta.importsExpression);
    }
  }
  if (meta.kind === R3NgModuleMetadataKind.Global) {
    if (meta.exports.length > 0) {
      scopeMap.set("exports", refsToArray(meta.exports, meta.containsForwardDecls));
    }
  } else {
    if (meta.exportsExpression) {
      scopeMap.set("exports", meta.exportsExpression);
    }
  }
  if (meta.kind === R3NgModuleMetadataKind.Local && meta.bootstrapExpression) {
    scopeMap.set("bootstrap", meta.bootstrapExpression);
  }
  if (Object.keys(scopeMap.values).length === 0) {
    return null;
  }
  const fnCall = new InvokeFunctionExpr(
    /* fn */
    importExpr(Identifiers.setNgModuleScope),
    /* args */
    [meta.type.value, scopeMap.toLiteralMap()]
  );
  const guardedCall = jitOnlyGuardedExpression(fnCall);
  const iife = new FunctionExpr(
    /* params */
    [],
    /* statements */
    [guardedCall.toStmt()]
  );
  const iifeCall = new InvokeFunctionExpr(
    /* fn */
    iife,
    /* args */
    []
  );
  return iifeCall.toStmt();
}
function tupleTypeOf(exp) {
  const types = exp.map((ref) => typeofExpr(ref.type));
  return exp.length > 0 ? expressionType(literalArr(types)) : NONE_TYPE;
}
function tupleOfTypes(types) {
  const typeofTypes = types.map((type) => typeofExpr(type));
  return types.length > 0 ? expressionType(literalArr(typeofTypes)) : NONE_TYPE;
}
function compilePipeFromMetadata(metadata) {
  const definitionMapValues = [];
  definitionMapValues.push({ key: "name", value: literal(metadata.pipeName), quoted: false });
  definitionMapValues.push({ key: "type", value: metadata.type.value, quoted: false });
  definitionMapValues.push({ key: "pure", value: literal(metadata.pure), quoted: false });
  if (metadata.isStandalone === false) {
    definitionMapValues.push({ key: "standalone", value: literal(false), quoted: false });
  }
  const expression = importExpr(Identifiers.definePipe).callFn([literalMap(definitionMapValues)], void 0, true);
  const type = createPipeType(metadata);
  return { expression, type, statements: [] };
}
function createPipeType(metadata) {
  return new ExpressionType(importExpr(Identifiers.PipeDeclaration, [
    typeWithParameters(metadata.type.type, metadata.typeArgumentCount),
    new ExpressionType(new LiteralExpr(metadata.pipeName)),
    new ExpressionType(new LiteralExpr(metadata.isStandalone))
  ]));
}
var R3TemplateDependencyKind;
(function(R3TemplateDependencyKind2) {
  R3TemplateDependencyKind2[R3TemplateDependencyKind2["Directive"] = 0] = "Directive";
  R3TemplateDependencyKind2[R3TemplateDependencyKind2["Pipe"] = 1] = "Pipe";
  R3TemplateDependencyKind2[R3TemplateDependencyKind2["NgModule"] = 2] = "NgModule";
})(R3TemplateDependencyKind || (R3TemplateDependencyKind = {}));
const animationKeywords = /* @__PURE__ */ new Set([
  // global values
  "inherit",
  "initial",
  "revert",
  "unset",
  // animation-direction
  "alternate",
  "alternate-reverse",
  "normal",
  "reverse",
  // animation-fill-mode
  "backwards",
  "both",
  "forwards",
  "none",
  // animation-play-state
  "paused",
  "running",
  // animation-timing-function
  "ease",
  "ease-in",
  "ease-in-out",
  "ease-out",
  "linear",
  "step-start",
  "step-end",
  // `steps()` function
  "end",
  "jump-both",
  "jump-end",
  "jump-none",
  "jump-start",
  "start"
]);
const scopedAtRuleIdentifiers = [
  "@media",
  "@supports",
  "@document",
  "@layer",
  "@container",
  "@scope",
  "@starting-style"
];
class ShadowCss {
  /*
   * Shim some cssText with the given selector. Returns cssText that can be included in the document
   *
   * The selector is the attribute added to all elements inside the host,
   * The hostSelector is the attribute added to the host itself.
   */
  shimCssText(cssText, selector, hostSelector = "") {
    const comments = [];
    cssText = cssText.replace(_commentRe, (m) => {
      if (m.match(_commentWithHashRe)) {
        comments.push(m);
      } else {
        const newLinesMatches = m.match(_newLinesRe);
        comments.push((newLinesMatches?.join("") ?? "") + "\n");
      }
      return COMMENT_PLACEHOLDER;
    });
    cssText = this._insertDirectives(cssText);
    const scopedCssText = this._scopeCssText(cssText, selector, hostSelector);
    let commentIdx = 0;
    return scopedCssText.replace(_commentWithHashPlaceHolderRe, () => comments[commentIdx++]);
  }
  _insertDirectives(cssText) {
    cssText = this._insertPolyfillDirectivesInCssText(cssText);
    return this._insertPolyfillRulesInCssText(cssText);
  }
  /**
   * Process styles to add scope to keyframes.
   *
   * Modify both the names of the keyframes defined in the component styles and also the css
   * animation rules using them.
   *
   * Animation rules using keyframes defined elsewhere are not modified to allow for globally
   * defined keyframes.
   *
   * For example, we convert this css:
   *
   * ```
   * .box {
   *   animation: box-animation 1s forwards;
   * }
   *
   * @keyframes box-animation {
   *   to {
   *     background-color: green;
   *   }
   * }
   * ```
   *
   * to this:
   *
   * ```
   * .box {
   *   animation: scopeName_box-animation 1s forwards;
   * }
   *
   * @keyframes scopeName_box-animation {
   *   to {
   *     background-color: green;
   *   }
   * }
   * ```
   *
   * @param cssText the component's css text that needs to be scoped.
   * @param scopeSelector the component's scope selector.
   *
   * @returns the scoped css text.
   */
  _scopeKeyframesRelatedCss(cssText, scopeSelector) {
    const unscopedKeyframesSet = /* @__PURE__ */ new Set();
    const scopedKeyframesCssText = processRules(cssText, (rule) => this._scopeLocalKeyframeDeclarations(rule, scopeSelector, unscopedKeyframesSet));
    return processRules(scopedKeyframesCssText, (rule) => this._scopeAnimationRule(rule, scopeSelector, unscopedKeyframesSet));
  }
  /**
   * Scopes local keyframes names, returning the updated css rule and it also
   * adds the original keyframe name to a provided set to collect all keyframes names
   * so that it can later be used to scope the animation rules.
   *
   * For example, it takes a rule such as:
   *
   * ```
   * @keyframes box-animation {
   *   to {
   *     background-color: green;
   *   }
   * }
   * ```
   *
   * and returns:
   *
   * ```
   * @keyframes scopeName_box-animation {
   *   to {
   *     background-color: green;
   *   }
   * }
   * ```
   * and as a side effect it adds "box-animation" to the `unscopedKeyframesSet` set
   *
   * @param cssRule the css rule to process.
   * @param scopeSelector the component's scope selector.
   * @param unscopedKeyframesSet the set of unscoped keyframes names (which can be
   * modified as a side effect)
   *
   * @returns the css rule modified with the scoped keyframes name.
   */
  _scopeLocalKeyframeDeclarations(rule, scopeSelector, unscopedKeyframesSet) {
    return {
      ...rule,
      selector: rule.selector.replace(/(^@(?:-webkit-)?keyframes(?:\s+))(['"]?)(.+)\2(\s*)$/, (_, start, quote, keyframeName, endSpaces) => {
        unscopedKeyframesSet.add(unescapeQuotes(keyframeName, quote));
        return `${start}${quote}${scopeSelector}_${keyframeName}${quote}${endSpaces}`;
      })
    };
  }
  /**
   * Function used to scope a keyframes name (obtained from an animation declaration)
   * using an existing set of unscopedKeyframes names to discern if the scoping needs to be
   * performed (keyframes names of keyframes not defined in the component's css need not to be
   * scoped).
   *
   * @param keyframe the keyframes name to check.
   * @param scopeSelector the component's scope selector.
   * @param unscopedKeyframesSet the set of unscoped keyframes names.
   *
   * @returns the scoped name of the keyframe, or the original name is the name need not to be
   * scoped.
   */
  _scopeAnimationKeyframe(keyframe, scopeSelector, unscopedKeyframesSet) {
    return keyframe.replace(/^(\s*)(['"]?)(.+?)\2(\s*)$/, (_, spaces1, quote, name, spaces2) => {
      name = `${unscopedKeyframesSet.has(unescapeQuotes(name, quote)) ? scopeSelector + "_" : ""}${name}`;
      return `${spaces1}${quote}${name}${quote}${spaces2}`;
    });
  }
  /**
   * Regular expression used to extrapolate the possible keyframes from an
   * animation declaration (with possibly multiple animation definitions)
   *
   * The regular expression can be divided in three parts
   *  - (^|\s+|,)
   *    captures how many (if any) leading whitespaces are present or a comma
   *  - (?:(?:(['"])((?:\\\\|\\\2|(?!\2).)+)\2)|(-?[A-Za-z][\w\-]*))
   *    captures two different possible keyframes, ones which are quoted or ones which are valid css
   * indents (custom properties excluded)
   *  - (?=[,\s;]|$)
   *    simply matches the end of the possible keyframe, valid endings are: a comma, a space, a
   * semicolon or the end of the string
   */
  _animationDeclarationKeyframesRe = /(^|\s+|,)(?:(?:(['"])((?:\\\\|\\\2|(?!\2).)+)\2)|(-?[A-Za-z][\w\-]*))(?=[,\s]|$)/g;
  /**
   * Scope an animation rule so that the keyframes mentioned in such rule
   * are scoped if defined in the component's css and left untouched otherwise.
   *
   * It can scope values of both the 'animation' and 'animation-name' properties.
   *
   * @param rule css rule to scope.
   * @param scopeSelector the component's scope selector.
   * @param unscopedKeyframesSet the set of unscoped keyframes names.
   *
   * @returns the updated css rule.
   **/
  _scopeAnimationRule(rule, scopeSelector, unscopedKeyframesSet) {
    let content = rule.content.replace(/((?:^|\s+|;)(?:-webkit-)?animation\s*:\s*),*([^;]+)/g, (_, start, animationDeclarations) => start + animationDeclarations.replace(this._animationDeclarationKeyframesRe, (original, leadingSpaces, quote = "", quotedName, nonQuotedName) => {
      if (quotedName) {
        return `${leadingSpaces}${this._scopeAnimationKeyframe(`${quote}${quotedName}${quote}`, scopeSelector, unscopedKeyframesSet)}`;
      } else {
        return animationKeywords.has(nonQuotedName) ? original : `${leadingSpaces}${this._scopeAnimationKeyframe(nonQuotedName, scopeSelector, unscopedKeyframesSet)}`;
      }
    }));
    content = content.replace(/((?:^|\s+|;)(?:-webkit-)?animation-name(?:\s*):(?:\s*))([^;]+)/g, (_match, start, commaSeparatedKeyframes) => `${start}${commaSeparatedKeyframes.split(",").map((keyframe) => this._scopeAnimationKeyframe(keyframe, scopeSelector, unscopedKeyframesSet)).join(",")}`);
    return { ...rule, content };
  }
  /*
   * Process styles to convert native ShadowDOM rules that will trip
   * up the css parser; we rely on decorating the stylesheet with inert rules.
   *
   * For example, we convert this rule:
   *
   * polyfill-next-selector { content: ':host menu-item'; }
   * ::content menu-item {
   *
   * to this:
   *
   * scopeName menu-item {
   *
   **/
  _insertPolyfillDirectivesInCssText(cssText) {
    return cssText.replace(_cssContentNextSelectorRe, function(...m) {
      return m[2] + "{";
    });
  }
  /*
   * Process styles to add rules which will only apply under the polyfill
   *
   * For example, we convert this rule:
   *
   * polyfill-rule {
   *   content: ':host menu-item';
   * ...
   * }
   *
   * to this:
   *
   * scopeName menu-item {...}
   *
   **/
  _insertPolyfillRulesInCssText(cssText) {
    return cssText.replace(_cssContentRuleRe, (...m) => {
      const rule = m[0].replace(m[1], "").replace(m[2], "");
      return m[4] + rule;
    });
  }
  /* Ensure styles are scoped. Pseudo-scoping takes a rule like:
   *
   *  .foo {... }
   *
   *  and converts this to
   *
   *  scopeName .foo { ... }
   */
  _scopeCssText(cssText, scopeSelector, hostSelector) {
    const unscopedRules = this._extractUnscopedRulesFromCssText(cssText);
    cssText = this._insertPolyfillHostInCssText(cssText);
    cssText = this._convertColonHost(cssText);
    cssText = this._convertColonHostContext(cssText);
    cssText = this._convertShadowDOMSelectors(cssText);
    if (scopeSelector) {
      cssText = this._scopeKeyframesRelatedCss(cssText, scopeSelector);
      cssText = this._scopeSelectors(cssText, scopeSelector, hostSelector);
    }
    cssText = cssText + "\n" + unscopedRules;
    return cssText.trim();
  }
  /*
   * Process styles to add rules which will only apply under the polyfill
   * and do not process via CSSOM. (CSSOM is destructive to rules on rare
   * occasions, e.g. -webkit-calc on Safari.)
   * For example, we convert this rule:
   *
   * @polyfill-unscoped-rule {
   *   content: 'menu-item';
   * ... }
   *
   * to this:
   *
   * menu-item {...}
   *
   **/
  _extractUnscopedRulesFromCssText(cssText) {
    let r = "";
    let m;
    _cssContentUnscopedRuleRe.lastIndex = 0;
    while ((m = _cssContentUnscopedRuleRe.exec(cssText)) !== null) {
      const rule = m[0].replace(m[2], "").replace(m[1], m[4]);
      r += rule + "\n\n";
    }
    return r;
  }
  /*
   * convert a rule like :host(.foo) > .bar { }
   *
   * to
   *
   * .foo<scopeName> > .bar
   */
  _convertColonHost(cssText) {
    return cssText.replace(_cssColonHostRe, (_, hostSelectors, otherSelectors) => {
      if (hostSelectors) {
        const convertedSelectors = [];
        const hostSelectorArray = hostSelectors.split(",").map((p) => p.trim());
        for (const hostSelector of hostSelectorArray) {
          if (!hostSelector)
            break;
          const convertedSelector = _polyfillHostNoCombinator + hostSelector.replace(_polyfillHost, "") + otherSelectors;
          convertedSelectors.push(convertedSelector);
        }
        return convertedSelectors.join(",");
      } else {
        return _polyfillHostNoCombinator + otherSelectors;
      }
    });
  }
  /*
   * convert a rule like :host-context(.foo) > .bar { }
   *
   * to
   *
   * .foo<scopeName> > .bar, .foo <scopeName> > .bar { }
   *
   * and
   *
   * :host-context(.foo:host) .bar { ... }
   *
   * to
   *
   * .foo<scopeName> .bar { ... }
   */
  _convertColonHostContext(cssText) {
    return cssText.replace(_cssColonHostContextReGlobal, (selectorText, pseudoPrefix) => {
      const contextSelectorGroups = [[]];
      let match;
      while (match = _cssColonHostContextRe.exec(selectorText)) {
        const newContextSelectors = (match[1] ?? "").trim().split(",").map((m) => m.trim()).filter((m) => m !== "");
        const contextSelectorGroupsLength = contextSelectorGroups.length;
        repeatGroups(contextSelectorGroups, newContextSelectors.length);
        for (let i = 0; i < newContextSelectors.length; i++) {
          for (let j = 0; j < contextSelectorGroupsLength; j++) {
            contextSelectorGroups[j + i * contextSelectorGroupsLength].push(newContextSelectors[i]);
          }
        }
        selectorText = match[2];
      }
      return contextSelectorGroups.map((contextSelectors) => _combineHostContextSelectors(contextSelectors, selectorText, pseudoPrefix)).join(", ");
    });
  }
  /*
   * Convert combinators like ::shadow and pseudo-elements like ::content
   * by replacing with space.
   */
  _convertShadowDOMSelectors(cssText) {
    return _shadowDOMSelectorsRe.reduce((result, pattern) => result.replace(pattern, " "), cssText);
  }
  // change a selector like 'div' to 'name div'
  _scopeSelectors(cssText, scopeSelector, hostSelector) {
    return processRules(cssText, (rule) => {
      let selector = rule.selector;
      let content = rule.content;
      if (rule.selector[0] !== "@") {
        selector = this._scopeSelector({
          selector,
          scopeSelector,
          hostSelector,
          isParentSelector: true
        });
      } else if (scopedAtRuleIdentifiers.some((atRule) => rule.selector.startsWith(atRule))) {
        content = this._scopeSelectors(rule.content, scopeSelector, hostSelector);
      } else if (rule.selector.startsWith("@font-face") || rule.selector.startsWith("@page")) {
        content = this._stripScopingSelectors(rule.content);
      }
      return new CssRule(selector, content);
    });
  }
  /**
   * Handle a css text that is within a rule that should not contain scope selectors by simply
   * removing them! An example of such a rule is `@font-face`.
   *
   * `@font-face` rules cannot contain nested selectors. Nor can they be nested under a selector.
   * Normally this would be a syntax error by the author of the styles. But in some rare cases, such
   * as importing styles from a library, and applying `:host ::ng-deep` to the imported styles, we
   * can end up with broken css if the imported styles happen to contain @font-face rules.
   *
   * For example:
   *
   * ```
   * :host ::ng-deep {
   *   import 'some/lib/containing/font-face';
   * }
   *
   * Similar logic applies to `@page` rules which can contain a particular set of properties,
   * as well as some specific at-rules. Since they can't be encapsulated, we have to strip
   * any scoping selectors from them. For more information: https://www.w3.org/TR/css-page-3
   * ```
   */
  _stripScopingSelectors(cssText) {
    return processRules(cssText, (rule) => {
      const selector = rule.selector.replace(_shadowDeepSelectors, " ").replace(_polyfillHostNoCombinatorRe, " ");
      return new CssRule(selector, rule.content);
    });
  }
  _safeSelector;
  _shouldScopeIndicator;
  // `isParentSelector` is used to distinguish the selectors which are coming from
  // the initial selector string and any nested selectors, parsed recursively,
  // for example `selector = 'a:where(.one)'` could be the parent, while recursive call
  // would have `selector = '.one'`.
  _scopeSelector({ selector, scopeSelector, hostSelector, isParentSelector = false }) {
    const selectorSplitRe = / ?,(?!(?:[^)(]*(?:\([^)(]*(?:\([^)(]*(?:\([^)(]*\)[^)(]*)*\)[^)(]*)*\)[^)(]*)*\))) ?/;
    return selector.split(selectorSplitRe).map((part) => part.split(_shadowDeepSelectors)).map((deepParts) => {
      const [shallowPart, ...otherParts] = deepParts;
      const applyScope = (shallowPart2) => {
        if (this._selectorNeedsScoping(shallowPart2, scopeSelector)) {
          return this._applySelectorScope({
            selector: shallowPart2,
            scopeSelector,
            hostSelector,
            isParentSelector
          });
        } else {
          return shallowPart2;
        }
      };
      return [applyScope(shallowPart), ...otherParts].join(" ");
    }).join(", ");
  }
  _selectorNeedsScoping(selector, scopeSelector) {
    const re = this._makeScopeMatcher(scopeSelector);
    return !re.test(selector);
  }
  _makeScopeMatcher(scopeSelector) {
    const lre = /\[/g;
    const rre = /\]/g;
    scopeSelector = scopeSelector.replace(lre, "\\[").replace(rre, "\\]");
    return new RegExp("^(" + scopeSelector + ")" + _selectorReSuffix, "m");
  }
  // scope via name and [is=name]
  _applySimpleSelectorScope(selector, scopeSelector, hostSelector) {
    _polyfillHostRe.lastIndex = 0;
    if (_polyfillHostRe.test(selector)) {
      const replaceBy = `[${hostSelector}]`;
      let result = selector;
      while (result.match(_polyfillHostNoCombinatorRe)) {
        result = result.replace(_polyfillHostNoCombinatorRe, (_hnc, selector2) => {
          return selector2.replace(/([^:\)]*)(:*)(.*)/, (_, before, colon, after) => {
            return before + replaceBy + colon + after;
          });
        });
      }
      return result.replace(_polyfillHostRe, replaceBy);
    }
    return scopeSelector + " " + selector;
  }
  // return a selector with [name] suffix on each simple selector
  // e.g. .foo.bar > .zot becomes .foo[name].bar[name] > .zot[name]  /** @internal */
  _applySelectorScope({ selector, scopeSelector, hostSelector, isParentSelector }) {
    const isRe = /\[is=([^\]]*)\]/g;
    scopeSelector = scopeSelector.replace(isRe, (_, ...parts) => parts[0]);
    const attrName = `[${scopeSelector}]`;
    const _scopeSelectorPart = (p) => {
      let scopedP = p.trim();
      if (!scopedP) {
        return p;
      }
      if (p.includes(_polyfillHostNoCombinator)) {
        scopedP = this._applySimpleSelectorScope(p, scopeSelector, hostSelector);
        if (!p.match(_polyfillHostNoCombinatorOutsidePseudoFunction)) {
          const [_, before, colon, after] = scopedP.match(/([^:]*)(:*)([\s\S]*)/);
          scopedP = before + attrName + colon + after;
        }
      } else {
        const t = p.replace(_polyfillHostRe, "");
        if (t.length > 0) {
          const matches = t.match(/([^:]*)(:*)([\s\S]*)/);
          if (matches) {
            scopedP = matches[1] + attrName + matches[2] + matches[3];
          }
        }
      }
      return scopedP;
    };
    const _pseudoFunctionAwareScopeSelectorPart = (selectorPart) => {
      let scopedPart = "";
      const pseudoSelectorParts = [];
      let pseudoSelectorMatch;
      while ((pseudoSelectorMatch = _cssPrefixWithPseudoSelectorFunction.exec(selectorPart)) !== null) {
        let openedBrackets = 1;
        let index = _cssPrefixWithPseudoSelectorFunction.lastIndex;
        while (index < selectorPart.length) {
          const currentSymbol = selectorPart[index];
          index++;
          if (currentSymbol === "(") {
            openedBrackets++;
            continue;
          }
          if (currentSymbol === ")") {
            openedBrackets--;
            if (openedBrackets === 0) {
              break;
            }
            continue;
          }
        }
        pseudoSelectorParts.push(`${pseudoSelectorMatch[0]}${selectorPart.slice(_cssPrefixWithPseudoSelectorFunction.lastIndex, index)}`);
        _cssPrefixWithPseudoSelectorFunction.lastIndex = index;
      }
      if (pseudoSelectorParts.join("") === selectorPart) {
        scopedPart = pseudoSelectorParts.map((selectorPart2) => {
          const [cssPseudoSelectorFunction] = selectorPart2.match(_cssPrefixWithPseudoSelectorFunction) ?? [];
          const selectorToScope = selectorPart2.slice(cssPseudoSelectorFunction?.length, -1);
          if (selectorToScope.includes(_polyfillHostNoCombinator)) {
            this._shouldScopeIndicator = true;
          }
          const scopedInnerPart = this._scopeSelector({
            selector: selectorToScope,
            scopeSelector,
            hostSelector
          });
          return `${cssPseudoSelectorFunction}${scopedInnerPart})`;
        }).join("");
      } else {
        this._shouldScopeIndicator = this._shouldScopeIndicator || selectorPart.includes(_polyfillHostNoCombinator);
        scopedPart = this._shouldScopeIndicator ? _scopeSelectorPart(selectorPart) : selectorPart;
      }
      return scopedPart;
    };
    if (isParentSelector) {
      this._safeSelector = new SafeSelector(selector);
      selector = this._safeSelector.content();
    }
    let scopedSelector = "";
    let startIndex = 0;
    let res;
    const sep = /( |>|\+|~(?!=))(?!([^)(]*(?:\([^)(]*(?:\([^)(]*(?:\([^)(]*\)[^)(]*)*\)[^)(]*)*\)[^)(]*)*\)))\s*/g;
    const hasHost = selector.includes(_polyfillHostNoCombinator);
    if (isParentSelector || this._shouldScopeIndicator) {
      this._shouldScopeIndicator = !hasHost;
    }
    while ((res = sep.exec(selector)) !== null) {
      const separator = res[1];
      const part2 = selector.slice(startIndex, res.index);
      if (part2.match(/__esc-ph-(\d+)__/) && selector[res.index + 1]?.match(/[a-fA-F\d]/)) {
        continue;
      }
      const scopedPart = _pseudoFunctionAwareScopeSelectorPart(part2);
      scopedSelector += `${scopedPart} ${separator} `;
      startIndex = sep.lastIndex;
    }
    const part = selector.substring(startIndex);
    scopedSelector += _pseudoFunctionAwareScopeSelectorPart(part);
    return this._safeSelector.restore(scopedSelector);
  }
  _insertPolyfillHostInCssText(selector) {
    return selector.replace(_colonHostContextRe, _polyfillHostContext).replace(_colonHostRe, _polyfillHost);
  }
}
class SafeSelector {
  placeholders = [];
  index = 0;
  _content;
  constructor(selector) {
    selector = this._escapeRegexMatches(selector, /(\[[^\]]*\])/g);
    selector = selector.replace(/(\\.)/g, (_, keep) => {
      const replaceBy = `__esc-ph-${this.index}__`;
      this.placeholders.push(keep);
      this.index++;
      return replaceBy;
    });
    this._content = selector.replace(/(:nth-[-\w]+)(\([^)]+\))/g, (_, pseudo, exp) => {
      const replaceBy = `__ph-${this.index}__`;
      this.placeholders.push(exp);
      this.index++;
      return pseudo + replaceBy;
    });
  }
  restore(content) {
    return content.replace(/__(?:ph|esc-ph)-(\d+)__/g, (_ph, index) => this.placeholders[+index]);
  }
  content() {
    return this._content;
  }
  /**
   * Replaces all of the substrings that match a regex within a
   * special string (e.g. `__ph-0__`, `__ph-1__`, etc).
   */
  _escapeRegexMatches(content, pattern) {
    return content.replace(pattern, (_, keep) => {
      const replaceBy = `__ph-${this.index}__`;
      this.placeholders.push(keep);
      this.index++;
      return replaceBy;
    });
  }
}
const _cssScopedPseudoFunctionPrefix = "(:(where|is)\\()?";
const _cssPrefixWithPseudoSelectorFunction = /:(where|is)\(/gi;
const _cssContentNextSelectorRe = /polyfill-next-selector[^}]*content:[\s]*?(['"])(.*?)\1[;\s]*}([^{]*?){/gim;
const _cssContentRuleRe = /(polyfill-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const _cssContentUnscopedRuleRe = /(polyfill-unscoped-rule)[^}]*(content:[\s]*(['"])(.*?)\3)[;\s]*[^}]*}/gim;
const _polyfillHost = "-shadowcsshost";
const _polyfillHostContext = "-shadowcsscontext";
const _parenSuffix = "(?:\\(((?:\\([^)(]*\\)|[^)(]*)+?)\\))?([^,{]*)";
const _cssColonHostRe = new RegExp(_polyfillHost + _parenSuffix, "gim");
const _cssColonHostContextReGlobal = new RegExp(_cssScopedPseudoFunctionPrefix + "(" + _polyfillHostContext + _parenSuffix + ")", "gim");
const _cssColonHostContextRe = new RegExp(_polyfillHostContext + _parenSuffix, "im");
const _polyfillHostNoCombinator = _polyfillHost + "-no-combinator";
const _polyfillHostNoCombinatorOutsidePseudoFunction = new RegExp(`${_polyfillHostNoCombinator}(?![^(]*\\))`, "g");
const _polyfillHostNoCombinatorRe = /-shadowcsshost-no-combinator([^\s,]*)/;
const _shadowDOMSelectorsRe = [
  /::shadow/g,
  /::content/g,
  // Deprecated selectors
  /\/shadow-deep\//g,
  /\/shadow\//g
];
const _shadowDeepSelectors = /(?:>>>)|(?:\/deep\/)|(?:::ng-deep)/g;
const _selectorReSuffix = "([>\\s~+[.,{:][\\s\\S]*)?$";
const _polyfillHostRe = /-shadowcsshost/gim;
const _colonHostRe = /:host/gim;
const _colonHostContextRe = /:host-context/gim;
const _newLinesRe = /\r?\n/g;
const _commentRe = /\/\*[\s\S]*?\*\//g;
const _commentWithHashRe = /\/\*\s*#\s*source(Mapping)?URL=/g;
const COMMENT_PLACEHOLDER = "%COMMENT%";
const _commentWithHashPlaceHolderRe = new RegExp(COMMENT_PLACEHOLDER, "g");
const BLOCK_PLACEHOLDER = "%BLOCK%";
const _ruleRe = new RegExp(`(\\s*(?:${COMMENT_PLACEHOLDER}\\s*)*)([^;\\{\\}]+?)(\\s*)((?:{%BLOCK%}?\\s*;?)|(?:\\s*;))`, "g");
const CONTENT_PAIRS = /* @__PURE__ */ new Map([["{", "}"]]);
const COMMA_IN_PLACEHOLDER = "%COMMA_IN_PLACEHOLDER%";
const SEMI_IN_PLACEHOLDER = "%SEMI_IN_PLACEHOLDER%";
const COLON_IN_PLACEHOLDER = "%COLON_IN_PLACEHOLDER%";
const _cssCommaInPlaceholderReGlobal = new RegExp(COMMA_IN_PLACEHOLDER, "g");
const _cssSemiInPlaceholderReGlobal = new RegExp(SEMI_IN_PLACEHOLDER, "g");
const _cssColonInPlaceholderReGlobal = new RegExp(COLON_IN_PLACEHOLDER, "g");
class CssRule {
  selector;
  content;
  constructor(selector, content) {
    this.selector = selector;
    this.content = content;
  }
}
function processRules(input, ruleCallback) {
  const escaped = escapeInStrings(input);
  const inputWithEscapedBlocks = escapeBlocks(escaped, CONTENT_PAIRS, BLOCK_PLACEHOLDER);
  let nextBlockIndex = 0;
  const escapedResult = inputWithEscapedBlocks.escapedString.replace(_ruleRe, (...m) => {
    const selector = m[2];
    let content = "";
    let suffix = m[4];
    let contentPrefix = "";
    if (suffix && suffix.startsWith("{" + BLOCK_PLACEHOLDER)) {
      content = inputWithEscapedBlocks.blocks[nextBlockIndex++];
      suffix = suffix.substring(BLOCK_PLACEHOLDER.length + 1);
      contentPrefix = "{";
    }
    const rule = ruleCallback(new CssRule(selector, content));
    return `${m[1]}${rule.selector}${m[3]}${contentPrefix}${rule.content}${suffix}`;
  });
  return unescapeInStrings(escapedResult);
}
class StringWithEscapedBlocks {
  escapedString;
  blocks;
  constructor(escapedString, blocks) {
    this.escapedString = escapedString;
    this.blocks = blocks;
  }
}
function escapeBlocks(input, charPairs, placeholder) {
  const resultParts = [];
  const escapedBlocks = [];
  let openCharCount = 0;
  let nonBlockStartIndex = 0;
  let blockStartIndex = -1;
  let openChar;
  let closeChar;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "\\") {
      i++;
    } else if (char === closeChar) {
      openCharCount--;
      if (openCharCount === 0) {
        escapedBlocks.push(input.substring(blockStartIndex, i));
        resultParts.push(placeholder);
        nonBlockStartIndex = i;
        blockStartIndex = -1;
        openChar = closeChar = void 0;
      }
    } else if (char === openChar) {
      openCharCount++;
    } else if (openCharCount === 0 && charPairs.has(char)) {
      openChar = char;
      closeChar = charPairs.get(char);
      openCharCount = 1;
      blockStartIndex = i + 1;
      resultParts.push(input.substring(nonBlockStartIndex, blockStartIndex));
    }
  }
  if (blockStartIndex !== -1) {
    escapedBlocks.push(input.substring(blockStartIndex));
    resultParts.push(placeholder);
  } else {
    resultParts.push(input.substring(nonBlockStartIndex));
  }
  return new StringWithEscapedBlocks(resultParts.join(""), escapedBlocks);
}
const ESCAPE_IN_STRING_MAP = {
  ";": SEMI_IN_PLACEHOLDER,
  ",": COMMA_IN_PLACEHOLDER,
  ":": COLON_IN_PLACEHOLDER
};
function escapeInStrings(input) {
  let result = input;
  let currentQuoteChar = null;
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    if (char === "\\") {
      i++;
    } else {
      if (currentQuoteChar !== null) {
        if (char === currentQuoteChar) {
          currentQuoteChar = null;
        } else {
          const placeholder = ESCAPE_IN_STRING_MAP[char];
          if (placeholder) {
            result = `${result.substr(0, i)}${placeholder}${result.substr(i + 1)}`;
            i += placeholder.length - 1;
          }
        }
      } else if (char === "'" || char === '"') {
        currentQuoteChar = char;
      }
    }
  }
  return result;
}
function unescapeInStrings(input) {
  let result = input.replace(_cssCommaInPlaceholderReGlobal, ",");
  result = result.replace(_cssSemiInPlaceholderReGlobal, ";");
  result = result.replace(_cssColonInPlaceholderReGlobal, ":");
  return result;
}
function unescapeQuotes(str, isQuoted) {
  return !isQuoted ? str : str.replace(/((?:^|[^\\])(?:\\\\)*)\\(?=['"])/g, "$1");
}
function _combineHostContextSelectors(contextSelectors, otherSelectors, pseudoPrefix = "") {
  const hostMarker = _polyfillHostNoCombinator;
  _polyfillHostRe.lastIndex = 0;
  const otherSelectorsHasHost = _polyfillHostRe.test(otherSelectors);
  if (contextSelectors.length === 0) {
    return hostMarker + otherSelectors;
  }
  const combined = [contextSelectors.pop() || ""];
  while (contextSelectors.length > 0) {
    const length = combined.length;
    const contextSelector = contextSelectors.pop();
    for (let i = 0; i < length; i++) {
      const previousSelectors = combined[i];
      combined[length * 2 + i] = previousSelectors + " " + contextSelector;
      combined[length + i] = contextSelector + " " + previousSelectors;
      combined[i] = contextSelector + previousSelectors;
    }
  }
  return combined.map((s) => otherSelectorsHasHost ? `${pseudoPrefix}${s}${otherSelectors}` : `${pseudoPrefix}${s}${hostMarker}${otherSelectors}, ${pseudoPrefix}${s} ${hostMarker}${otherSelectors}`).join(",");
}
function repeatGroups(groups, multiples) {
  const length = groups.length;
  for (let i = 1; i < multiples; i++) {
    for (let j = 0; j < length; j++) {
      groups[j + i * length] = groups[j].slice(0);
    }
  }
}
var OpKind;
(function(OpKind2) {
  OpKind2[OpKind2["ListEnd"] = 0] = "ListEnd";
  OpKind2[OpKind2["Statement"] = 1] = "Statement";
  OpKind2[OpKind2["Variable"] = 2] = "Variable";
  OpKind2[OpKind2["ElementStart"] = 3] = "ElementStart";
  OpKind2[OpKind2["Element"] = 4] = "Element";
  OpKind2[OpKind2["Template"] = 5] = "Template";
  OpKind2[OpKind2["ElementEnd"] = 6] = "ElementEnd";
  OpKind2[OpKind2["ContainerStart"] = 7] = "ContainerStart";
  OpKind2[OpKind2["Container"] = 8] = "Container";
  OpKind2[OpKind2["ContainerEnd"] = 9] = "ContainerEnd";
  OpKind2[OpKind2["DisableBindings"] = 10] = "DisableBindings";
  OpKind2[OpKind2["Conditional"] = 11] = "Conditional";
  OpKind2[OpKind2["EnableBindings"] = 12] = "EnableBindings";
  OpKind2[OpKind2["Text"] = 13] = "Text";
  OpKind2[OpKind2["Listener"] = 14] = "Listener";
  OpKind2[OpKind2["InterpolateText"] = 15] = "InterpolateText";
  OpKind2[OpKind2["Binding"] = 16] = "Binding";
  OpKind2[OpKind2["Property"] = 17] = "Property";
  OpKind2[OpKind2["StyleProp"] = 18] = "StyleProp";
  OpKind2[OpKind2["ClassProp"] = 19] = "ClassProp";
  OpKind2[OpKind2["StyleMap"] = 20] = "StyleMap";
  OpKind2[OpKind2["ClassMap"] = 21] = "ClassMap";
  OpKind2[OpKind2["Advance"] = 22] = "Advance";
  OpKind2[OpKind2["Pipe"] = 23] = "Pipe";
  OpKind2[OpKind2["Attribute"] = 24] = "Attribute";
  OpKind2[OpKind2["ExtractedAttribute"] = 25] = "ExtractedAttribute";
  OpKind2[OpKind2["Defer"] = 26] = "Defer";
  OpKind2[OpKind2["DeferOn"] = 27] = "DeferOn";
  OpKind2[OpKind2["DeferWhen"] = 28] = "DeferWhen";
  OpKind2[OpKind2["I18nMessage"] = 29] = "I18nMessage";
  OpKind2[OpKind2["HostProperty"] = 30] = "HostProperty";
  OpKind2[OpKind2["Namespace"] = 31] = "Namespace";
  OpKind2[OpKind2["ProjectionDef"] = 32] = "ProjectionDef";
  OpKind2[OpKind2["Projection"] = 33] = "Projection";
  OpKind2[OpKind2["RepeaterCreate"] = 34] = "RepeaterCreate";
  OpKind2[OpKind2["Repeater"] = 35] = "Repeater";
  OpKind2[OpKind2["TwoWayProperty"] = 36] = "TwoWayProperty";
  OpKind2[OpKind2["TwoWayListener"] = 37] = "TwoWayListener";
  OpKind2[OpKind2["DeclareLet"] = 38] = "DeclareLet";
  OpKind2[OpKind2["StoreLet"] = 39] = "StoreLet";
  OpKind2[OpKind2["I18nStart"] = 40] = "I18nStart";
  OpKind2[OpKind2["I18n"] = 41] = "I18n";
  OpKind2[OpKind2["I18nEnd"] = 42] = "I18nEnd";
  OpKind2[OpKind2["I18nExpression"] = 43] = "I18nExpression";
  OpKind2[OpKind2["I18nApply"] = 44] = "I18nApply";
  OpKind2[OpKind2["IcuStart"] = 45] = "IcuStart";
  OpKind2[OpKind2["IcuEnd"] = 46] = "IcuEnd";
  OpKind2[OpKind2["IcuPlaceholder"] = 47] = "IcuPlaceholder";
  OpKind2[OpKind2["I18nContext"] = 48] = "I18nContext";
  OpKind2[OpKind2["I18nAttributes"] = 49] = "I18nAttributes";
})(OpKind || (OpKind = {}));
var ExpressionKind;
(function(ExpressionKind2) {
  ExpressionKind2[ExpressionKind2["LexicalRead"] = 0] = "LexicalRead";
  ExpressionKind2[ExpressionKind2["Context"] = 1] = "Context";
  ExpressionKind2[ExpressionKind2["TrackContext"] = 2] = "TrackContext";
  ExpressionKind2[ExpressionKind2["ReadVariable"] = 3] = "ReadVariable";
  ExpressionKind2[ExpressionKind2["NextContext"] = 4] = "NextContext";
  ExpressionKind2[ExpressionKind2["Reference"] = 5] = "Reference";
  ExpressionKind2[ExpressionKind2["StoreLet"] = 6] = "StoreLet";
  ExpressionKind2[ExpressionKind2["ContextLetReference"] = 7] = "ContextLetReference";
  ExpressionKind2[ExpressionKind2["GetCurrentView"] = 8] = "GetCurrentView";
  ExpressionKind2[ExpressionKind2["RestoreView"] = 9] = "RestoreView";
  ExpressionKind2[ExpressionKind2["ResetView"] = 10] = "ResetView";
  ExpressionKind2[ExpressionKind2["PureFunctionExpr"] = 11] = "PureFunctionExpr";
  ExpressionKind2[ExpressionKind2["PureFunctionParameterExpr"] = 12] = "PureFunctionParameterExpr";
  ExpressionKind2[ExpressionKind2["PipeBinding"] = 13] = "PipeBinding";
  ExpressionKind2[ExpressionKind2["PipeBindingVariadic"] = 14] = "PipeBindingVariadic";
  ExpressionKind2[ExpressionKind2["SafePropertyRead"] = 15] = "SafePropertyRead";
  ExpressionKind2[ExpressionKind2["SafeKeyedRead"] = 16] = "SafeKeyedRead";
  ExpressionKind2[ExpressionKind2["SafeInvokeFunction"] = 17] = "SafeInvokeFunction";
  ExpressionKind2[ExpressionKind2["SafeTernaryExpr"] = 18] = "SafeTernaryExpr";
  ExpressionKind2[ExpressionKind2["EmptyExpr"] = 19] = "EmptyExpr";
  ExpressionKind2[ExpressionKind2["AssignTemporaryExpr"] = 20] = "AssignTemporaryExpr";
  ExpressionKind2[ExpressionKind2["ReadTemporaryExpr"] = 21] = "ReadTemporaryExpr";
  ExpressionKind2[ExpressionKind2["SlotLiteralExpr"] = 22] = "SlotLiteralExpr";
  ExpressionKind2[ExpressionKind2["ConditionalCase"] = 23] = "ConditionalCase";
  ExpressionKind2[ExpressionKind2["ConstCollected"] = 24] = "ConstCollected";
  ExpressionKind2[ExpressionKind2["TwoWayBindingSet"] = 25] = "TwoWayBindingSet";
})(ExpressionKind || (ExpressionKind = {}));
var VariableFlags;
(function(VariableFlags2) {
  VariableFlags2[VariableFlags2["None"] = 0] = "None";
  VariableFlags2[VariableFlags2["AlwaysInline"] = 1] = "AlwaysInline";
})(VariableFlags || (VariableFlags = {}));
var SemanticVariableKind;
(function(SemanticVariableKind2) {
  SemanticVariableKind2[SemanticVariableKind2["Context"] = 0] = "Context";
  SemanticVariableKind2[SemanticVariableKind2["Identifier"] = 1] = "Identifier";
  SemanticVariableKind2[SemanticVariableKind2["SavedView"] = 2] = "SavedView";
  SemanticVariableKind2[SemanticVariableKind2["Alias"] = 3] = "Alias";
})(SemanticVariableKind || (SemanticVariableKind = {}));
var CompatibilityMode;
(function(CompatibilityMode2) {
  CompatibilityMode2[CompatibilityMode2["Normal"] = 0] = "Normal";
  CompatibilityMode2[CompatibilityMode2["TemplateDefinitionBuilder"] = 1] = "TemplateDefinitionBuilder";
})(CompatibilityMode || (CompatibilityMode = {}));
var BindingKind;
(function(BindingKind2) {
  BindingKind2[BindingKind2["Attribute"] = 0] = "Attribute";
  BindingKind2[BindingKind2["ClassName"] = 1] = "ClassName";
  BindingKind2[BindingKind2["StyleProperty"] = 2] = "StyleProperty";
  BindingKind2[BindingKind2["Property"] = 3] = "Property";
  BindingKind2[BindingKind2["Template"] = 4] = "Template";
  BindingKind2[BindingKind2["I18n"] = 5] = "I18n";
  BindingKind2[BindingKind2["Animation"] = 6] = "Animation";
  BindingKind2[BindingKind2["TwoWayProperty"] = 7] = "TwoWayProperty";
})(BindingKind || (BindingKind = {}));
var I18nParamResolutionTime;
(function(I18nParamResolutionTime2) {
  I18nParamResolutionTime2[I18nParamResolutionTime2["Creation"] = 0] = "Creation";
  I18nParamResolutionTime2[I18nParamResolutionTime2["Postproccessing"] = 1] = "Postproccessing";
})(I18nParamResolutionTime || (I18nParamResolutionTime = {}));
var I18nExpressionFor;
(function(I18nExpressionFor2) {
  I18nExpressionFor2[I18nExpressionFor2["I18nText"] = 0] = "I18nText";
  I18nExpressionFor2[I18nExpressionFor2["I18nAttribute"] = 1] = "I18nAttribute";
})(I18nExpressionFor || (I18nExpressionFor = {}));
var I18nParamValueFlags;
(function(I18nParamValueFlags2) {
  I18nParamValueFlags2[I18nParamValueFlags2["None"] = 0] = "None";
  I18nParamValueFlags2[I18nParamValueFlags2["ElementTag"] = 1] = "ElementTag";
  I18nParamValueFlags2[I18nParamValueFlags2["TemplateTag"] = 2] = "TemplateTag";
  I18nParamValueFlags2[I18nParamValueFlags2["OpenTag"] = 4] = "OpenTag";
  I18nParamValueFlags2[I18nParamValueFlags2["CloseTag"] = 8] = "CloseTag";
  I18nParamValueFlags2[I18nParamValueFlags2["ExpressionIndex"] = 16] = "ExpressionIndex";
})(I18nParamValueFlags || (I18nParamValueFlags = {}));
var Namespace;
(function(Namespace2) {
  Namespace2[Namespace2["HTML"] = 0] = "HTML";
  Namespace2[Namespace2["SVG"] = 1] = "SVG";
  Namespace2[Namespace2["Math"] = 2] = "Math";
})(Namespace || (Namespace = {}));
var DeferTriggerKind;
(function(DeferTriggerKind2) {
  DeferTriggerKind2[DeferTriggerKind2["Idle"] = 0] = "Idle";
  DeferTriggerKind2[DeferTriggerKind2["Immediate"] = 1] = "Immediate";
  DeferTriggerKind2[DeferTriggerKind2["Timer"] = 2] = "Timer";
  DeferTriggerKind2[DeferTriggerKind2["Hover"] = 3] = "Hover";
  DeferTriggerKind2[DeferTriggerKind2["Interaction"] = 4] = "Interaction";
  DeferTriggerKind2[DeferTriggerKind2["Viewport"] = 5] = "Viewport";
  DeferTriggerKind2[DeferTriggerKind2["Never"] = 6] = "Never";
})(DeferTriggerKind || (DeferTriggerKind = {}));
var I18nContextKind;
(function(I18nContextKind2) {
  I18nContextKind2[I18nContextKind2["RootI18n"] = 0] = "RootI18n";
  I18nContextKind2[I18nContextKind2["Icu"] = 1] = "Icu";
  I18nContextKind2[I18nContextKind2["Attr"] = 2] = "Attr";
})(I18nContextKind || (I18nContextKind = {}));
var TemplateKind;
(function(TemplateKind2) {
  TemplateKind2[TemplateKind2["NgTemplate"] = 0] = "NgTemplate";
  TemplateKind2[TemplateKind2["Structural"] = 1] = "Structural";
  TemplateKind2[TemplateKind2["Block"] = 2] = "Block";
})(TemplateKind || (TemplateKind = {}));
const ConsumesSlot = Symbol("ConsumesSlot");
const DependsOnSlotContext = Symbol("DependsOnSlotContext");
const ConsumesVarsTrait = Symbol("ConsumesVars");
const UsesVarOffset = Symbol("UsesVarOffset");
const TRAIT_CONSUMES_SLOT = {
  [ConsumesSlot]: true,
  numSlotsUsed: 1
};
const TRAIT_DEPENDS_ON_SLOT_CONTEXT = {
  [DependsOnSlotContext]: true
};
const TRAIT_CONSUMES_VARS = {
  [ConsumesVarsTrait]: true
};
function hasConsumesSlotTrait(op) {
  return op[ConsumesSlot] === true;
}
function hasDependsOnSlotContextTrait(value) {
  return value[DependsOnSlotContext] === true;
}
function hasConsumesVarsTrait(value) {
  return value[ConsumesVarsTrait] === true;
}
function hasUsesVarOffsetTrait(expr) {
  return expr[UsesVarOffset] === true;
}
function createStatementOp(statement) {
  return {
    kind: OpKind.Statement,
    statement,
    ...NEW_OP
  };
}
function createVariableOp(xref, variable2, initializer, flags) {
  return {
    kind: OpKind.Variable,
    xref,
    variable: variable2,
    initializer,
    flags,
    ...NEW_OP
  };
}
const NEW_OP = {
  debugListId: null,
  prev: null,
  next: null
};
function createInterpolateTextOp(xref, interpolation, sourceSpan) {
  return {
    kind: OpKind.InterpolateText,
    target: xref,
    interpolation,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
class Interpolation {
  strings;
  expressions;
  i18nPlaceholders;
  constructor(strings, expressions, i18nPlaceholders) {
    this.strings = strings;
    this.expressions = expressions;
    this.i18nPlaceholders = i18nPlaceholders;
    if (i18nPlaceholders.length !== 0 && i18nPlaceholders.length !== expressions.length) {
      throw new Error(`Expected ${expressions.length} placeholders to match interpolation expression count, but got ${i18nPlaceholders.length}`);
    }
  }
}
function createBindingOp(target, kind, name, expression, unit, securityContext, isTextAttribute, isStructuralTemplateAttribute, templateKind, i18nMessage, sourceSpan) {
  return {
    kind: OpKind.Binding,
    bindingKind: kind,
    target,
    name,
    expression,
    unit,
    securityContext,
    isTextAttribute,
    isStructuralTemplateAttribute,
    templateKind,
    i18nContext: null,
    i18nMessage,
    sourceSpan,
    ...NEW_OP
  };
}
function createPropertyOp(target, name, expression, isAnimationTrigger, securityContext, isStructuralTemplateAttribute, templateKind, i18nContext, i18nMessage, sourceSpan) {
  return {
    kind: OpKind.Property,
    target,
    name,
    expression,
    isAnimationTrigger,
    securityContext,
    sanitizer: null,
    isStructuralTemplateAttribute,
    templateKind,
    i18nContext,
    i18nMessage,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
function createTwoWayPropertyOp(target, name, expression, securityContext, isStructuralTemplateAttribute, templateKind, i18nContext, i18nMessage, sourceSpan) {
  return {
    kind: OpKind.TwoWayProperty,
    target,
    name,
    expression,
    securityContext,
    sanitizer: null,
    isStructuralTemplateAttribute,
    templateKind,
    i18nContext,
    i18nMessage,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
function createStylePropOp(xref, name, expression, unit, sourceSpan) {
  return {
    kind: OpKind.StyleProp,
    target: xref,
    name,
    expression,
    unit,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
function createClassPropOp(xref, name, expression, sourceSpan) {
  return {
    kind: OpKind.ClassProp,
    target: xref,
    name,
    expression,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
function createStyleMapOp(xref, expression, sourceSpan) {
  return {
    kind: OpKind.StyleMap,
    target: xref,
    expression,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
function createClassMapOp(xref, expression, sourceSpan) {
  return {
    kind: OpKind.ClassMap,
    target: xref,
    expression,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
function createAttributeOp(target, namespace, name, expression, securityContext, isTextAttribute, isStructuralTemplateAttribute, templateKind, i18nMessage, sourceSpan) {
  return {
    kind: OpKind.Attribute,
    target,
    namespace,
    name,
    expression,
    securityContext,
    sanitizer: null,
    isTextAttribute,
    isStructuralTemplateAttribute,
    templateKind,
    i18nContext: null,
    i18nMessage,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
function createAdvanceOp(delta, sourceSpan) {
  return {
    kind: OpKind.Advance,
    delta,
    sourceSpan,
    ...NEW_OP
  };
}
function createConditionalOp(target, test, conditions, sourceSpan) {
  return {
    kind: OpKind.Conditional,
    target,
    test,
    conditions,
    processed: null,
    sourceSpan,
    contextValue: null,
    ...NEW_OP,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS
  };
}
function createRepeaterOp(repeaterCreate2, targetSlot, collection, sourceSpan) {
  return {
    kind: OpKind.Repeater,
    target: repeaterCreate2,
    targetSlot,
    collection,
    sourceSpan,
    ...NEW_OP,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT
  };
}
function createDeferWhenOp(target, expr, modifier, sourceSpan) {
  return {
    kind: OpKind.DeferWhen,
    target,
    expr,
    modifier,
    sourceSpan,
    ...NEW_OP,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS
  };
}
function createI18nExpressionOp(context, target, i18nOwner, handle, expression, icuPlaceholder, i18nPlaceholder, resolutionTime, usage, name, sourceSpan) {
  return {
    kind: OpKind.I18nExpression,
    context,
    target,
    i18nOwner,
    handle,
    expression,
    icuPlaceholder,
    i18nPlaceholder,
    resolutionTime,
    usage,
    name,
    sourceSpan,
    ...NEW_OP,
    ...TRAIT_CONSUMES_VARS,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT
  };
}
function createI18nApplyOp(owner, handle, sourceSpan) {
  return {
    kind: OpKind.I18nApply,
    owner,
    handle,
    sourceSpan,
    ...NEW_OP
  };
}
function createStoreLetOp(target, declaredName, value, sourceSpan) {
  return {
    kind: OpKind.StoreLet,
    target,
    declaredName,
    value,
    sourceSpan,
    ...TRAIT_DEPENDS_ON_SLOT_CONTEXT,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
function isIrExpression(expr) {
  return expr instanceof ExpressionBase;
}
class ExpressionBase extends Expression {
  constructor(sourceSpan = null) {
    super(null, sourceSpan);
  }
}
class LexicalReadExpr extends ExpressionBase {
  name;
  kind = ExpressionKind.LexicalRead;
  constructor(name) {
    super();
    this.name = name;
  }
  visitExpression(visitor, context) {
  }
  isEquivalent(other) {
    return this.name === other.name;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions() {
  }
  clone() {
    return new LexicalReadExpr(this.name);
  }
}
class ReferenceExpr extends ExpressionBase {
  target;
  targetSlot;
  offset;
  kind = ExpressionKind.Reference;
  constructor(target, targetSlot, offset) {
    super();
    this.target = target;
    this.targetSlot = targetSlot;
    this.offset = offset;
  }
  visitExpression() {
  }
  isEquivalent(e) {
    return e instanceof ReferenceExpr && e.target === this.target;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions() {
  }
  clone() {
    return new ReferenceExpr(this.target, this.targetSlot, this.offset);
  }
}
class StoreLetExpr extends ExpressionBase {
  target;
  value;
  sourceSpan;
  kind = ExpressionKind.StoreLet;
  [ConsumesVarsTrait] = true;
  [DependsOnSlotContext] = true;
  constructor(target, value, sourceSpan) {
    super();
    this.target = target;
    this.value = value;
    this.sourceSpan = sourceSpan;
  }
  visitExpression() {
  }
  isEquivalent(e) {
    return e instanceof StoreLetExpr && e.target === this.target && e.value.isEquivalent(this.value);
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.value = transformExpressionsInExpression(this.value, transform2, flags);
  }
  clone() {
    return new StoreLetExpr(this.target, this.value, this.sourceSpan);
  }
}
class ContextLetReferenceExpr extends ExpressionBase {
  target;
  targetSlot;
  kind = ExpressionKind.ContextLetReference;
  constructor(target, targetSlot) {
    super();
    this.target = target;
    this.targetSlot = targetSlot;
  }
  visitExpression() {
  }
  isEquivalent(e) {
    return e instanceof ContextLetReferenceExpr && e.target === this.target;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions() {
  }
  clone() {
    return new ContextLetReferenceExpr(this.target, this.targetSlot);
  }
}
class ContextExpr extends ExpressionBase {
  view;
  kind = ExpressionKind.Context;
  constructor(view) {
    super();
    this.view = view;
  }
  visitExpression() {
  }
  isEquivalent(e) {
    return e instanceof ContextExpr && e.view === this.view;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions() {
  }
  clone() {
    return new ContextExpr(this.view);
  }
}
class TrackContextExpr extends ExpressionBase {
  view;
  kind = ExpressionKind.TrackContext;
  constructor(view) {
    super();
    this.view = view;
  }
  visitExpression() {
  }
  isEquivalent(e) {
    return e instanceof TrackContextExpr && e.view === this.view;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions() {
  }
  clone() {
    return new TrackContextExpr(this.view);
  }
}
class NextContextExpr extends ExpressionBase {
  kind = ExpressionKind.NextContext;
  steps = 1;
  constructor() {
    super();
  }
  visitExpression() {
  }
  isEquivalent(e) {
    return e instanceof NextContextExpr && e.steps === this.steps;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions() {
  }
  clone() {
    const expr = new NextContextExpr();
    expr.steps = this.steps;
    return expr;
  }
}
class GetCurrentViewExpr extends ExpressionBase {
  kind = ExpressionKind.GetCurrentView;
  constructor() {
    super();
  }
  visitExpression() {
  }
  isEquivalent(e) {
    return e instanceof GetCurrentViewExpr;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions() {
  }
  clone() {
    return new GetCurrentViewExpr();
  }
}
class RestoreViewExpr extends ExpressionBase {
  view;
  kind = ExpressionKind.RestoreView;
  constructor(view) {
    super();
    this.view = view;
  }
  visitExpression(visitor, context) {
    if (typeof this.view !== "number") {
      this.view.visitExpression(visitor, context);
    }
  }
  isEquivalent(e) {
    if (!(e instanceof RestoreViewExpr) || typeof e.view !== typeof this.view) {
      return false;
    }
    if (typeof this.view === "number") {
      return this.view === e.view;
    } else {
      return this.view.isEquivalent(e.view);
    }
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    if (typeof this.view !== "number") {
      this.view = transformExpressionsInExpression(this.view, transform2, flags);
    }
  }
  clone() {
    return new RestoreViewExpr(this.view instanceof Expression ? this.view.clone() : this.view);
  }
}
class ResetViewExpr extends ExpressionBase {
  expr;
  kind = ExpressionKind.ResetView;
  constructor(expr) {
    super();
    this.expr = expr;
  }
  visitExpression(visitor, context) {
    this.expr.visitExpression(visitor, context);
  }
  isEquivalent(e) {
    return e instanceof ResetViewExpr && this.expr.isEquivalent(e.expr);
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.expr = transformExpressionsInExpression(this.expr, transform2, flags);
  }
  clone() {
    return new ResetViewExpr(this.expr.clone());
  }
}
class TwoWayBindingSetExpr extends ExpressionBase {
  target;
  value;
  kind = ExpressionKind.TwoWayBindingSet;
  constructor(target, value) {
    super();
    this.target = target;
    this.value = value;
  }
  visitExpression(visitor, context) {
    this.target.visitExpression(visitor, context);
    this.value.visitExpression(visitor, context);
  }
  isEquivalent(other) {
    return this.target.isEquivalent(other.target) && this.value.isEquivalent(other.value);
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.target = transformExpressionsInExpression(this.target, transform2, flags);
    this.value = transformExpressionsInExpression(this.value, transform2, flags);
  }
  clone() {
    return new TwoWayBindingSetExpr(this.target, this.value);
  }
}
class ReadVariableExpr extends ExpressionBase {
  xref;
  kind = ExpressionKind.ReadVariable;
  name = null;
  constructor(xref) {
    super();
    this.xref = xref;
  }
  visitExpression() {
  }
  isEquivalent(other) {
    return other instanceof ReadVariableExpr && other.xref === this.xref;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions() {
  }
  clone() {
    const expr = new ReadVariableExpr(this.xref);
    expr.name = this.name;
    return expr;
  }
}
class PureFunctionExpr extends ExpressionBase {
  kind = ExpressionKind.PureFunctionExpr;
  [ConsumesVarsTrait] = true;
  [UsesVarOffset] = true;
  varOffset = null;
  /**
   * The expression which should be memoized as a pure computation.
   *
   * This expression contains internal `PureFunctionParameterExpr`s, which are placeholders for the
   * positional argument expressions in `args.
   */
  body;
  /**
   * Positional arguments to the pure function which will memoize the `body` expression, which act
   * as memoization keys.
   */
  args;
  /**
   * Once extracted to the `ConstantPool`, a reference to the function which defines the computation
   * of `body`.
   */
  fn = null;
  constructor(expression, args) {
    super();
    this.body = expression;
    this.args = args;
  }
  visitExpression(visitor, context) {
    this.body?.visitExpression(visitor, context);
    for (const arg of this.args) {
      arg.visitExpression(visitor, context);
    }
  }
  isEquivalent(other) {
    if (!(other instanceof PureFunctionExpr) || other.args.length !== this.args.length) {
      return false;
    }
    return other.body !== null && this.body !== null && other.body.isEquivalent(this.body) && other.args.every((arg, idx) => arg.isEquivalent(this.args[idx]));
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    if (this.body !== null) {
      this.body = transformExpressionsInExpression(this.body, transform2, flags | VisitorContextFlag.InChildOperation);
    } else if (this.fn !== null) {
      this.fn = transformExpressionsInExpression(this.fn, transform2, flags);
    }
    for (let i = 0; i < this.args.length; i++) {
      this.args[i] = transformExpressionsInExpression(this.args[i], transform2, flags);
    }
  }
  clone() {
    const expr = new PureFunctionExpr(this.body?.clone() ?? null, this.args.map((arg) => arg.clone()));
    expr.fn = this.fn?.clone() ?? null;
    expr.varOffset = this.varOffset;
    return expr;
  }
}
class PureFunctionParameterExpr extends ExpressionBase {
  index;
  kind = ExpressionKind.PureFunctionParameterExpr;
  constructor(index) {
    super();
    this.index = index;
  }
  visitExpression() {
  }
  isEquivalent(other) {
    return other instanceof PureFunctionParameterExpr && other.index === this.index;
  }
  isConstant() {
    return true;
  }
  transformInternalExpressions() {
  }
  clone() {
    return new PureFunctionParameterExpr(this.index);
  }
}
class PipeBindingExpr extends ExpressionBase {
  target;
  targetSlot;
  name;
  args;
  kind = ExpressionKind.PipeBinding;
  [ConsumesVarsTrait] = true;
  [UsesVarOffset] = true;
  varOffset = null;
  constructor(target, targetSlot, name, args) {
    super();
    this.target = target;
    this.targetSlot = targetSlot;
    this.name = name;
    this.args = args;
  }
  visitExpression(visitor, context) {
    for (const arg of this.args) {
      arg.visitExpression(visitor, context);
    }
  }
  isEquivalent() {
    return false;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    for (let idx = 0; idx < this.args.length; idx++) {
      this.args[idx] = transformExpressionsInExpression(this.args[idx], transform2, flags);
    }
  }
  clone() {
    const r = new PipeBindingExpr(this.target, this.targetSlot, this.name, this.args.map((a) => a.clone()));
    r.varOffset = this.varOffset;
    return r;
  }
}
class PipeBindingVariadicExpr extends ExpressionBase {
  target;
  targetSlot;
  name;
  args;
  numArgs;
  kind = ExpressionKind.PipeBindingVariadic;
  [ConsumesVarsTrait] = true;
  [UsesVarOffset] = true;
  varOffset = null;
  constructor(target, targetSlot, name, args, numArgs) {
    super();
    this.target = target;
    this.targetSlot = targetSlot;
    this.name = name;
    this.args = args;
    this.numArgs = numArgs;
  }
  visitExpression(visitor, context) {
    this.args.visitExpression(visitor, context);
  }
  isEquivalent() {
    return false;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.args = transformExpressionsInExpression(this.args, transform2, flags);
  }
  clone() {
    const r = new PipeBindingVariadicExpr(this.target, this.targetSlot, this.name, this.args.clone(), this.numArgs);
    r.varOffset = this.varOffset;
    return r;
  }
}
class SafePropertyReadExpr extends ExpressionBase {
  receiver;
  name;
  kind = ExpressionKind.SafePropertyRead;
  constructor(receiver, name) {
    super();
    this.receiver = receiver;
    this.name = name;
  }
  // An alias for name, which allows other logic to handle property reads and keyed reads together.
  get index() {
    return this.name;
  }
  visitExpression(visitor, context) {
    this.receiver.visitExpression(visitor, context);
  }
  isEquivalent() {
    return false;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.receiver = transformExpressionsInExpression(this.receiver, transform2, flags);
  }
  clone() {
    return new SafePropertyReadExpr(this.receiver.clone(), this.name);
  }
}
class SafeKeyedReadExpr extends ExpressionBase {
  receiver;
  index;
  kind = ExpressionKind.SafeKeyedRead;
  constructor(receiver, index, sourceSpan) {
    super(sourceSpan);
    this.receiver = receiver;
    this.index = index;
  }
  visitExpression(visitor, context) {
    this.receiver.visitExpression(visitor, context);
    this.index.visitExpression(visitor, context);
  }
  isEquivalent() {
    return false;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.receiver = transformExpressionsInExpression(this.receiver, transform2, flags);
    this.index = transformExpressionsInExpression(this.index, transform2, flags);
  }
  clone() {
    return new SafeKeyedReadExpr(this.receiver.clone(), this.index.clone(), this.sourceSpan);
  }
}
class SafeInvokeFunctionExpr extends ExpressionBase {
  receiver;
  args;
  kind = ExpressionKind.SafeInvokeFunction;
  constructor(receiver, args) {
    super();
    this.receiver = receiver;
    this.args = args;
  }
  visitExpression(visitor, context) {
    this.receiver.visitExpression(visitor, context);
    for (const a of this.args) {
      a.visitExpression(visitor, context);
    }
  }
  isEquivalent() {
    return false;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.receiver = transformExpressionsInExpression(this.receiver, transform2, flags);
    for (let i = 0; i < this.args.length; i++) {
      this.args[i] = transformExpressionsInExpression(this.args[i], transform2, flags);
    }
  }
  clone() {
    return new SafeInvokeFunctionExpr(this.receiver.clone(), this.args.map((a) => a.clone()));
  }
}
class SafeTernaryExpr extends ExpressionBase {
  guard;
  expr;
  kind = ExpressionKind.SafeTernaryExpr;
  constructor(guard, expr) {
    super();
    this.guard = guard;
    this.expr = expr;
  }
  visitExpression(visitor, context) {
    this.guard.visitExpression(visitor, context);
    this.expr.visitExpression(visitor, context);
  }
  isEquivalent() {
    return false;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.guard = transformExpressionsInExpression(this.guard, transform2, flags);
    this.expr = transformExpressionsInExpression(this.expr, transform2, flags);
  }
  clone() {
    return new SafeTernaryExpr(this.guard.clone(), this.expr.clone());
  }
}
class EmptyExpr extends ExpressionBase {
  kind = ExpressionKind.EmptyExpr;
  visitExpression(visitor, context) {
  }
  isEquivalent(e) {
    return e instanceof EmptyExpr;
  }
  isConstant() {
    return true;
  }
  clone() {
    return new EmptyExpr();
  }
  transformInternalExpressions() {
  }
}
class AssignTemporaryExpr extends ExpressionBase {
  expr;
  xref;
  kind = ExpressionKind.AssignTemporaryExpr;
  name = null;
  constructor(expr, xref) {
    super();
    this.expr = expr;
    this.xref = xref;
  }
  visitExpression(visitor, context) {
    this.expr.visitExpression(visitor, context);
  }
  isEquivalent() {
    return false;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
    this.expr = transformExpressionsInExpression(this.expr, transform2, flags);
  }
  clone() {
    const a = new AssignTemporaryExpr(this.expr.clone(), this.xref);
    a.name = this.name;
    return a;
  }
}
class ReadTemporaryExpr extends ExpressionBase {
  xref;
  kind = ExpressionKind.ReadTemporaryExpr;
  name = null;
  constructor(xref) {
    super();
    this.xref = xref;
  }
  visitExpression(visitor, context) {
  }
  isEquivalent() {
    return this.xref === this.xref;
  }
  isConstant() {
    return false;
  }
  transformInternalExpressions(transform2, flags) {
  }
  clone() {
    const r = new ReadTemporaryExpr(this.xref);
    r.name = this.name;
    return r;
  }
}
class SlotLiteralExpr extends ExpressionBase {
  slot;
  kind = ExpressionKind.SlotLiteralExpr;
  constructor(slot) {
    super();
    this.slot = slot;
  }
  visitExpression(visitor, context) {
  }
  isEquivalent(e) {
    return e instanceof SlotLiteralExpr && e.slot === this.slot;
  }
  isConstant() {
    return true;
  }
  clone() {
    return new SlotLiteralExpr(this.slot);
  }
  transformInternalExpressions() {
  }
}
class ConditionalCaseExpr extends ExpressionBase {
  expr;
  target;
  targetSlot;
  alias;
  kind = ExpressionKind.ConditionalCase;
  /**
   * Create an expression for one branch of a conditional.
   * @param expr The expression to be tested for this case. Might be null, as in an `else` case.
   * @param target The Xref of the view to be displayed if this condition is true.
   */
  constructor(expr, target, targetSlot, alias = null) {
    super();
    this.expr = expr;
    this.target = target;
    this.targetSlot = targetSlot;
    this.alias = alias;
  }
  visitExpression(visitor, context) {
    if (this.expr !== null) {
      this.expr.visitExpression(visitor, context);
    }
  }
  isEquivalent(e) {
    return e instanceof ConditionalCaseExpr && e.expr === this.expr;
  }
  isConstant() {
    return true;
  }
  clone() {
    return new ConditionalCaseExpr(this.expr, this.target, this.targetSlot);
  }
  transformInternalExpressions(transform2, flags) {
    if (this.expr !== null) {
      this.expr = transformExpressionsInExpression(this.expr, transform2, flags);
    }
  }
}
class ConstCollectedExpr extends ExpressionBase {
  expr;
  kind = ExpressionKind.ConstCollected;
  constructor(expr) {
    super();
    this.expr = expr;
  }
  transformInternalExpressions(transform2, flags) {
    this.expr = transform2(this.expr, flags);
  }
  visitExpression(visitor, context) {
    this.expr.visitExpression(visitor, context);
  }
  isEquivalent(e) {
    if (!(e instanceof ConstCollectedExpr)) {
      return false;
    }
    return this.expr.isEquivalent(e.expr);
  }
  isConstant() {
    return this.expr.isConstant();
  }
  clone() {
    return new ConstCollectedExpr(this.expr);
  }
}
function visitExpressionsInOp(op, visitor) {
  transformExpressionsInOp(op, (expr, flags) => {
    visitor(expr, flags);
    return expr;
  }, VisitorContextFlag.None);
}
var VisitorContextFlag;
(function(VisitorContextFlag2) {
  VisitorContextFlag2[VisitorContextFlag2["None"] = 0] = "None";
  VisitorContextFlag2[VisitorContextFlag2["InChildOperation"] = 1] = "InChildOperation";
})(VisitorContextFlag || (VisitorContextFlag = {}));
function transformExpressionsInInterpolation(interpolation, transform2, flags) {
  for (let i = 0; i < interpolation.expressions.length; i++) {
    interpolation.expressions[i] = transformExpressionsInExpression(interpolation.expressions[i], transform2, flags);
  }
}
function transformExpressionsInOp(op, transform2, flags) {
  switch (op.kind) {
    case OpKind.StyleProp:
    case OpKind.StyleMap:
    case OpKind.ClassProp:
    case OpKind.ClassMap:
    case OpKind.Binding:
      if (op.expression instanceof Interpolation) {
        transformExpressionsInInterpolation(op.expression, transform2, flags);
      } else {
        op.expression = transformExpressionsInExpression(op.expression, transform2, flags);
      }
      break;
    case OpKind.Property:
    case OpKind.HostProperty:
    case OpKind.Attribute:
      if (op.expression instanceof Interpolation) {
        transformExpressionsInInterpolation(op.expression, transform2, flags);
      } else {
        op.expression = transformExpressionsInExpression(op.expression, transform2, flags);
      }
      op.sanitizer = op.sanitizer && transformExpressionsInExpression(op.sanitizer, transform2, flags);
      break;
    case OpKind.TwoWayProperty:
      op.expression = transformExpressionsInExpression(op.expression, transform2, flags);
      op.sanitizer = op.sanitizer && transformExpressionsInExpression(op.sanitizer, transform2, flags);
      break;
    case OpKind.I18nExpression:
      op.expression = transformExpressionsInExpression(op.expression, transform2, flags);
      break;
    case OpKind.InterpolateText:
      transformExpressionsInInterpolation(op.interpolation, transform2, flags);
      break;
    case OpKind.Statement:
      transformExpressionsInStatement(op.statement, transform2, flags);
      break;
    case OpKind.Variable:
      op.initializer = transformExpressionsInExpression(op.initializer, transform2, flags);
      break;
    case OpKind.Conditional:
      for (const condition of op.conditions) {
        if (condition.expr === null) {
          continue;
        }
        condition.expr = transformExpressionsInExpression(condition.expr, transform2, flags);
      }
      if (op.processed !== null) {
        op.processed = transformExpressionsInExpression(op.processed, transform2, flags);
      }
      if (op.contextValue !== null) {
        op.contextValue = transformExpressionsInExpression(op.contextValue, transform2, flags);
      }
      break;
    case OpKind.Listener:
    case OpKind.TwoWayListener:
      for (const innerOp of op.handlerOps) {
        transformExpressionsInOp(innerOp, transform2, flags | VisitorContextFlag.InChildOperation);
      }
      break;
    case OpKind.ExtractedAttribute:
      op.expression = op.expression && transformExpressionsInExpression(op.expression, transform2, flags);
      op.trustedValueFn = op.trustedValueFn && transformExpressionsInExpression(op.trustedValueFn, transform2, flags);
      break;
    case OpKind.RepeaterCreate:
      op.track = transformExpressionsInExpression(op.track, transform2, flags);
      if (op.trackByFn !== null) {
        op.trackByFn = transformExpressionsInExpression(op.trackByFn, transform2, flags);
      }
      break;
    case OpKind.Repeater:
      op.collection = transformExpressionsInExpression(op.collection, transform2, flags);
      break;
    case OpKind.Defer:
      if (op.loadingConfig !== null) {
        op.loadingConfig = transformExpressionsInExpression(op.loadingConfig, transform2, flags);
      }
      if (op.placeholderConfig !== null) {
        op.placeholderConfig = transformExpressionsInExpression(op.placeholderConfig, transform2, flags);
      }
      if (op.resolverFn !== null) {
        op.resolverFn = transformExpressionsInExpression(op.resolverFn, transform2, flags);
      }
      break;
    case OpKind.I18nMessage:
      for (const [placeholder, expr] of op.params) {
        op.params.set(placeholder, transformExpressionsInExpression(expr, transform2, flags));
      }
      for (const [placeholder, expr] of op.postprocessingParams) {
        op.postprocessingParams.set(placeholder, transformExpressionsInExpression(expr, transform2, flags));
      }
      break;
    case OpKind.DeferWhen:
      op.expr = transformExpressionsInExpression(op.expr, transform2, flags);
      break;
    case OpKind.StoreLet:
      op.value = transformExpressionsInExpression(op.value, transform2, flags);
      break;
    case OpKind.Advance:
    case OpKind.Container:
    case OpKind.ContainerEnd:
    case OpKind.ContainerStart:
    case OpKind.DeferOn:
    case OpKind.DisableBindings:
    case OpKind.Element:
    case OpKind.ElementEnd:
    case OpKind.ElementStart:
    case OpKind.EnableBindings:
    case OpKind.I18n:
    case OpKind.I18nApply:
    case OpKind.I18nContext:
    case OpKind.I18nEnd:
    case OpKind.I18nStart:
    case OpKind.IcuEnd:
    case OpKind.IcuStart:
    case OpKind.Namespace:
    case OpKind.Pipe:
    case OpKind.Projection:
    case OpKind.ProjectionDef:
    case OpKind.Template:
    case OpKind.Text:
    case OpKind.I18nAttributes:
    case OpKind.IcuPlaceholder:
    case OpKind.DeclareLet:
      break;
    default:
      throw new Error(`AssertionError: transformExpressionsInOp doesn't handle ${OpKind[op.kind]}`);
  }
}
function transformExpressionsInExpression(expr, transform2, flags) {
  if (expr instanceof ExpressionBase) {
    expr.transformInternalExpressions(transform2, flags);
  } else if (expr instanceof BinaryOperatorExpr) {
    expr.lhs = transformExpressionsInExpression(expr.lhs, transform2, flags);
    expr.rhs = transformExpressionsInExpression(expr.rhs, transform2, flags);
  } else if (expr instanceof UnaryOperatorExpr) {
    expr.expr = transformExpressionsInExpression(expr.expr, transform2, flags);
  } else if (expr instanceof ReadPropExpr) {
    expr.receiver = transformExpressionsInExpression(expr.receiver, transform2, flags);
  } else if (expr instanceof ReadKeyExpr) {
    expr.receiver = transformExpressionsInExpression(expr.receiver, transform2, flags);
    expr.index = transformExpressionsInExpression(expr.index, transform2, flags);
  } else if (expr instanceof WritePropExpr) {
    expr.receiver = transformExpressionsInExpression(expr.receiver, transform2, flags);
    expr.value = transformExpressionsInExpression(expr.value, transform2, flags);
  } else if (expr instanceof WriteKeyExpr) {
    expr.receiver = transformExpressionsInExpression(expr.receiver, transform2, flags);
    expr.index = transformExpressionsInExpression(expr.index, transform2, flags);
    expr.value = transformExpressionsInExpression(expr.value, transform2, flags);
  } else if (expr instanceof InvokeFunctionExpr) {
    expr.fn = transformExpressionsInExpression(expr.fn, transform2, flags);
    for (let i = 0; i < expr.args.length; i++) {
      expr.args[i] = transformExpressionsInExpression(expr.args[i], transform2, flags);
    }
  } else if (expr instanceof LiteralArrayExpr) {
    for (let i = 0; i < expr.entries.length; i++) {
      expr.entries[i] = transformExpressionsInExpression(expr.entries[i], transform2, flags);
    }
  } else if (expr instanceof LiteralMapExpr) {
    for (let i = 0; i < expr.entries.length; i++) {
      expr.entries[i].value = transformExpressionsInExpression(expr.entries[i].value, transform2, flags);
    }
  } else if (expr instanceof ConditionalExpr) {
    expr.condition = transformExpressionsInExpression(expr.condition, transform2, flags);
    expr.trueCase = transformExpressionsInExpression(expr.trueCase, transform2, flags);
    if (expr.falseCase !== null) {
      expr.falseCase = transformExpressionsInExpression(expr.falseCase, transform2, flags);
    }
  } else if (expr instanceof TypeofExpr) {
    expr.expr = transformExpressionsInExpression(expr.expr, transform2, flags);
  } else if (expr instanceof WriteVarExpr) {
    expr.value = transformExpressionsInExpression(expr.value, transform2, flags);
  } else if (expr instanceof LocalizedString) {
    for (let i = 0; i < expr.expressions.length; i++) {
      expr.expressions[i] = transformExpressionsInExpression(expr.expressions[i], transform2, flags);
    }
  } else if (expr instanceof NotExpr) {
    expr.condition = transformExpressionsInExpression(expr.condition, transform2, flags);
  } else if (expr instanceof TaggedTemplateExpr) {
    expr.tag = transformExpressionsInExpression(expr.tag, transform2, flags);
    expr.template.expressions = expr.template.expressions.map((e) => transformExpressionsInExpression(e, transform2, flags));
  } else if (expr instanceof ArrowFunctionExpr) {
    if (Array.isArray(expr.body)) {
      for (let i = 0; i < expr.body.length; i++) {
        transformExpressionsInStatement(expr.body[i], transform2, flags);
      }
    } else {
      expr.body = transformExpressionsInExpression(expr.body, transform2, flags);
    }
  } else if (expr instanceof WrappedNodeExpr) ; else if (expr instanceof ReadVarExpr || expr instanceof ExternalExpr || expr instanceof LiteralExpr) ; else {
    throw new Error(`Unhandled expression kind: ${expr.constructor.name}`);
  }
  return transform2(expr, flags);
}
function transformExpressionsInStatement(stmt, transform2, flags) {
  if (stmt instanceof ExpressionStatement) {
    stmt.expr = transformExpressionsInExpression(stmt.expr, transform2, flags);
  } else if (stmt instanceof ReturnStatement) {
    stmt.value = transformExpressionsInExpression(stmt.value, transform2, flags);
  } else if (stmt instanceof DeclareVarStmt) {
    if (stmt.value !== void 0) {
      stmt.value = transformExpressionsInExpression(stmt.value, transform2, flags);
    }
  } else if (stmt instanceof IfStmt) {
    stmt.condition = transformExpressionsInExpression(stmt.condition, transform2, flags);
    for (const caseStatement of stmt.trueCase) {
      transformExpressionsInStatement(caseStatement, transform2, flags);
    }
    for (const caseStatement of stmt.falseCase) {
      transformExpressionsInStatement(caseStatement, transform2, flags);
    }
  } else {
    throw new Error(`Unhandled statement kind: ${stmt.constructor.name}`);
  }
}
function isStringLiteral(expr) {
  return expr instanceof LiteralExpr && typeof expr.value === "string";
}
class OpList {
  static nextListId = 0;
  /**
   * Debug ID of this `OpList` instance.
   */
  debugListId = OpList.nextListId++;
  // OpList uses static head/tail nodes of a special `ListEnd` type.
  // This avoids the need for special casing of the first and last list
  // elements in all list operations.
  head = {
    kind: OpKind.ListEnd,
    next: null,
    prev: null,
    debugListId: this.debugListId
  };
  tail = {
    kind: OpKind.ListEnd,
    next: null,
    prev: null,
    debugListId: this.debugListId
  };
  constructor() {
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }
  /**
   * Push a new operation to the tail of the list.
   */
  push(op) {
    if (Array.isArray(op)) {
      for (const o of op) {
        this.push(o);
      }
      return;
    }
    OpList.assertIsNotEnd(op);
    OpList.assertIsUnowned(op);
    op.debugListId = this.debugListId;
    const oldLast = this.tail.prev;
    op.prev = oldLast;
    oldLast.next = op;
    op.next = this.tail;
    this.tail.prev = op;
  }
  /**
   * Prepend one or more nodes to the start of the list.
   */
  prepend(ops) {
    if (ops.length === 0) {
      return;
    }
    for (const op of ops) {
      OpList.assertIsNotEnd(op);
      OpList.assertIsUnowned(op);
      op.debugListId = this.debugListId;
    }
    const first = this.head.next;
    let prev = this.head;
    for (const op of ops) {
      prev.next = op;
      op.prev = prev;
      prev = op;
    }
    prev.next = first;
    first.prev = prev;
  }
  /**
   * `OpList` is iterable via the iteration protocol.
   *
   * It's safe to mutate the part of the list that has already been returned by the iterator, up to
   * and including the last operation returned. Mutations beyond that point _may_ be safe, but may
   * also corrupt the iteration position and should be avoided.
   */
  *[Symbol.iterator]() {
    let current = this.head.next;
    while (current !== this.tail) {
      OpList.assertIsOwned(current, this.debugListId);
      const next = current.next;
      yield current;
      current = next;
    }
  }
  *reversed() {
    let current = this.tail.prev;
    while (current !== this.head) {
      OpList.assertIsOwned(current, this.debugListId);
      const prev = current.prev;
      yield current;
      current = prev;
    }
  }
  /**
   * Replace `oldOp` with `newOp` in the list.
   */
  static replace(oldOp, newOp) {
    OpList.assertIsNotEnd(oldOp);
    OpList.assertIsNotEnd(newOp);
    OpList.assertIsOwned(oldOp);
    OpList.assertIsUnowned(newOp);
    newOp.debugListId = oldOp.debugListId;
    if (oldOp.prev !== null) {
      oldOp.prev.next = newOp;
      newOp.prev = oldOp.prev;
    }
    if (oldOp.next !== null) {
      oldOp.next.prev = newOp;
      newOp.next = oldOp.next;
    }
    oldOp.debugListId = null;
    oldOp.prev = null;
    oldOp.next = null;
  }
  /**
   * Replace `oldOp` with some number of new operations in the list (which may include `oldOp`).
   */
  static replaceWithMany(oldOp, newOps) {
    if (newOps.length === 0) {
      OpList.remove(oldOp);
      return;
    }
    OpList.assertIsNotEnd(oldOp);
    OpList.assertIsOwned(oldOp);
    const listId = oldOp.debugListId;
    oldOp.debugListId = null;
    for (const newOp of newOps) {
      OpList.assertIsNotEnd(newOp);
      OpList.assertIsUnowned(newOp);
    }
    const { prev: oldPrev, next: oldNext } = oldOp;
    oldOp.prev = null;
    oldOp.next = null;
    let prev = oldPrev;
    for (const newOp of newOps) {
      this.assertIsUnowned(newOp);
      newOp.debugListId = listId;
      prev.next = newOp;
      newOp.prev = prev;
      newOp.next = null;
      prev = newOp;
    }
    const first = newOps[0];
    const last = prev;
    if (oldPrev !== null) {
      oldPrev.next = first;
      first.prev = oldPrev;
    }
    if (oldNext !== null) {
      oldNext.prev = last;
      last.next = oldNext;
    }
  }
  /**
   * Remove the given node from the list which contains it.
   */
  static remove(op) {
    OpList.assertIsNotEnd(op);
    OpList.assertIsOwned(op);
    op.prev.next = op.next;
    op.next.prev = op.prev;
    op.debugListId = null;
    op.prev = null;
    op.next = null;
  }
  /**
   * Insert `op` before `target`.
   */
  static insertBefore(op, target) {
    if (Array.isArray(op)) {
      for (const o of op) {
        this.insertBefore(o, target);
      }
      return;
    }
    OpList.assertIsOwned(target);
    if (target.prev === null) {
      throw new Error(`AssertionError: illegal operation on list start`);
    }
    OpList.assertIsNotEnd(op);
    OpList.assertIsUnowned(op);
    op.debugListId = target.debugListId;
    op.prev = null;
    target.prev.next = op;
    op.prev = target.prev;
    op.next = target;
    target.prev = op;
  }
  /**
   * Insert `op` after `target`.
   */
  static insertAfter(op, target) {
    OpList.assertIsOwned(target);
    if (target.next === null) {
      throw new Error(`AssertionError: illegal operation on list end`);
    }
    OpList.assertIsNotEnd(op);
    OpList.assertIsUnowned(op);
    op.debugListId = target.debugListId;
    target.next.prev = op;
    op.next = target.next;
    op.prev = target;
    target.next = op;
  }
  /**
   * Asserts that `op` does not currently belong to a list.
   */
  static assertIsUnowned(op) {
    if (op.debugListId !== null) {
      throw new Error(`AssertionError: illegal operation on owned node: ${OpKind[op.kind]}`);
    }
  }
  /**
   * Asserts that `op` currently belongs to a list. If `byList` is passed, `op` is asserted to
   * specifically belong to that list.
   */
  static assertIsOwned(op, byList) {
    if (op.debugListId === null) {
      throw new Error(`AssertionError: illegal operation on unowned node: ${OpKind[op.kind]}`);
    } else if (byList !== void 0 && op.debugListId !== byList) {
      throw new Error(`AssertionError: node belongs to the wrong list (expected ${byList}, actual ${op.debugListId})`);
    }
  }
  /**
   * Asserts that `op` is not a special `ListEnd` node.
   */
  static assertIsNotEnd(op) {
    if (op.kind === OpKind.ListEnd) {
      throw new Error(`AssertionError: illegal operation on list head or tail`);
    }
  }
}
class SlotHandle {
  slot = null;
}
const elementContainerOpKinds = /* @__PURE__ */ new Set([
  OpKind.Element,
  OpKind.ElementStart,
  OpKind.Container,
  OpKind.ContainerStart,
  OpKind.Template,
  OpKind.RepeaterCreate
]);
function isElementOrContainerOp(op) {
  return elementContainerOpKinds.has(op.kind);
}
function createElementStartOp(tag, xref, namespace, i18nPlaceholder, startSourceSpan, wholeSourceSpan) {
  return {
    kind: OpKind.ElementStart,
    xref,
    tag,
    handle: new SlotHandle(),
    attributes: null,
    localRefs: [],
    nonBindable: false,
    namespace,
    i18nPlaceholder,
    startSourceSpan,
    wholeSourceSpan,
    ...TRAIT_CONSUMES_SLOT,
    ...NEW_OP
  };
}
function createTemplateOp(xref, templateKind, tag, functionNameSuffix, namespace, i18nPlaceholder, startSourceSpan, wholeSourceSpan) {
  return {
    kind: OpKind.Template,
    xref,
    templateKind,
    attributes: null,
    tag,
    handle: new SlotHandle(),
    functionNameSuffix,
    decls: null,
    vars: null,
    localRefs: [],
    nonBindable: false,
    namespace,
    i18nPlaceholder,
    startSourceSpan,
    wholeSourceSpan,
    ...TRAIT_CONSUMES_SLOT,
    ...NEW_OP
  };
}
function createRepeaterCreateOp(primaryView, emptyView, tag, track, varNames, emptyTag, i18nPlaceholder, emptyI18nPlaceholder, startSourceSpan, wholeSourceSpan) {
  return {
    kind: OpKind.RepeaterCreate,
    attributes: null,
    xref: primaryView,
    handle: new SlotHandle(),
    emptyView,
    track,
    trackByFn: null,
    tag,
    emptyTag,
    emptyAttributes: null,
    functionNameSuffix: "For",
    namespace: Namespace.HTML,
    nonBindable: false,
    localRefs: [],
    decls: null,
    vars: null,
    varNames,
    usesComponentInstance: false,
    i18nPlaceholder,
    emptyI18nPlaceholder,
    startSourceSpan,
    wholeSourceSpan,
    ...TRAIT_CONSUMES_SLOT,
    ...NEW_OP,
    ...TRAIT_CONSUMES_VARS,
    numSlotsUsed: emptyView === null ? 2 : 3
  };
}
function createElementEndOp(xref, sourceSpan) {
  return {
    kind: OpKind.ElementEnd,
    xref,
    sourceSpan,
    ...NEW_OP
  };
}
function createDisableBindingsOp(xref) {
  return {
    kind: OpKind.DisableBindings,
    xref,
    ...NEW_OP
  };
}
function createEnableBindingsOp(xref) {
  return {
    kind: OpKind.EnableBindings,
    xref,
    ...NEW_OP
  };
}
function createTextOp(xref, initialValue, icuPlaceholder, sourceSpan) {
  return {
    kind: OpKind.Text,
    xref,
    handle: new SlotHandle(),
    initialValue,
    icuPlaceholder,
    sourceSpan,
    ...TRAIT_CONSUMES_SLOT,
    ...NEW_OP
  };
}
function createListenerOp(target, targetSlot, name, tag, handlerOps, animationPhase, eventTarget, hostListener, sourceSpan) {
  const handlerList = new OpList();
  handlerList.push(handlerOps);
  return {
    kind: OpKind.Listener,
    target,
    targetSlot,
    tag,
    hostListener,
    name,
    handlerOps: handlerList,
    handlerFnName: null,
    consumesDollarEvent: false,
    isAnimationListener: animationPhase !== null,
    animationPhase,
    eventTarget,
    sourceSpan,
    ...NEW_OP
  };
}
function createTwoWayListenerOp(target, targetSlot, name, tag, handlerOps, sourceSpan) {
  const handlerList = new OpList();
  handlerList.push(handlerOps);
  return {
    kind: OpKind.TwoWayListener,
    target,
    targetSlot,
    tag,
    name,
    handlerOps: handlerList,
    handlerFnName: null,
    sourceSpan,
    ...NEW_OP
  };
}
function createPipeOp(xref, slot, name) {
  return {
    kind: OpKind.Pipe,
    xref,
    handle: slot,
    name,
    ...NEW_OP,
    ...TRAIT_CONSUMES_SLOT
  };
}
function createNamespaceOp(namespace) {
  return {
    kind: OpKind.Namespace,
    active: namespace,
    ...NEW_OP
  };
}
function createProjectionDefOp(def) {
  return {
    kind: OpKind.ProjectionDef,
    def,
    ...NEW_OP
  };
}
function createProjectionOp(xref, selector, i18nPlaceholder, fallbackView, sourceSpan) {
  return {
    kind: OpKind.Projection,
    xref,
    handle: new SlotHandle(),
    selector,
    i18nPlaceholder,
    fallbackView,
    projectionSlotIndex: 0,
    attributes: null,
    localRefs: [],
    sourceSpan,
    ...NEW_OP,
    ...TRAIT_CONSUMES_SLOT,
    numSlotsUsed: fallbackView === null ? 1 : 2
  };
}
function createExtractedAttributeOp(target, bindingKind, namespace, name, expression, i18nContext, i18nMessage, securityContext) {
  return {
    kind: OpKind.ExtractedAttribute,
    target,
    bindingKind,
    namespace,
    name,
    expression,
    i18nContext,
    i18nMessage,
    securityContext,
    trustedValueFn: null,
    ...NEW_OP
  };
}
function createDeferOp(xref, main, mainSlot, ownResolverFn, resolverFn, sourceSpan) {
  return {
    kind: OpKind.Defer,
    xref,
    handle: new SlotHandle(),
    mainView: main,
    mainSlot,
    loadingView: null,
    loadingSlot: null,
    loadingConfig: null,
    loadingMinimumTime: null,
    loadingAfterTime: null,
    placeholderView: null,
    placeholderSlot: null,
    placeholderConfig: null,
    placeholderMinimumTime: null,
    errorView: null,
    errorSlot: null,
    ownResolverFn,
    resolverFn,
    flags: null,
    sourceSpan,
    ...NEW_OP,
    ...TRAIT_CONSUMES_SLOT,
    numSlotsUsed: 2
  };
}
function createDeferOnOp(defer2, trigger, modifier, sourceSpan) {
  return {
    kind: OpKind.DeferOn,
    defer: defer2,
    trigger,
    modifier,
    sourceSpan,
    ...NEW_OP
  };
}
function createDeclareLetOp(xref, declaredName, sourceSpan) {
  return {
    kind: OpKind.DeclareLet,
    xref,
    declaredName,
    sourceSpan,
    handle: new SlotHandle(),
    ...TRAIT_CONSUMES_SLOT,
    ...NEW_OP
  };
}
function createI18nMessageOp(xref, i18nContext, i18nBlock, message, messagePlaceholder, params, postprocessingParams, needsPostprocessing) {
  return {
    kind: OpKind.I18nMessage,
    xref,
    i18nContext,
    i18nBlock,
    message,
    messagePlaceholder,
    params,
    postprocessingParams,
    needsPostprocessing,
    subMessages: [],
    ...NEW_OP
  };
}
function createI18nStartOp(xref, message, root, sourceSpan) {
  return {
    kind: OpKind.I18nStart,
    xref,
    handle: new SlotHandle(),
    root: root ?? xref,
    message,
    messageIndex: null,
    subTemplateIndex: null,
    context: null,
    sourceSpan,
    ...NEW_OP,
    ...TRAIT_CONSUMES_SLOT
  };
}
function createI18nEndOp(xref, sourceSpan) {
  return {
    kind: OpKind.I18nEnd,
    xref,
    sourceSpan,
    ...NEW_OP
  };
}
function createIcuStartOp(xref, message, messagePlaceholder, sourceSpan) {
  return {
    kind: OpKind.IcuStart,
    xref,
    message,
    messagePlaceholder,
    context: null,
    sourceSpan,
    ...NEW_OP
  };
}
function createIcuEndOp(xref) {
  return {
    kind: OpKind.IcuEnd,
    xref,
    ...NEW_OP
  };
}
function createIcuPlaceholderOp(xref, name, strings) {
  return {
    kind: OpKind.IcuPlaceholder,
    xref,
    name,
    strings,
    expressionPlaceholders: [],
    ...NEW_OP
  };
}
function createI18nContextOp(contextKind, xref, i18nBlock, message, sourceSpan) {
  if (i18nBlock === null && contextKind !== I18nContextKind.Attr) {
    throw new Error("AssertionError: i18nBlock must be provided for non-attribute contexts.");
  }
  return {
    kind: OpKind.I18nContext,
    contextKind,
    xref,
    i18nBlock,
    message,
    sourceSpan,
    params: /* @__PURE__ */ new Map(),
    postprocessingParams: /* @__PURE__ */ new Map(),
    ...NEW_OP
  };
}
function createI18nAttributesOp(xref, handle, target) {
  return {
    kind: OpKind.I18nAttributes,
    xref,
    handle,
    target,
    i18nAttributesConfig: null,
    ...NEW_OP,
    ...TRAIT_CONSUMES_SLOT
  };
}
function createHostPropertyOp(name, expression, isAnimationTrigger, i18nContext, securityContext, sourceSpan) {
  return {
    kind: OpKind.HostProperty,
    name,
    expression,
    isAnimationTrigger,
    i18nContext,
    securityContext,
    sanitizer: null,
    sourceSpan,
    ...TRAIT_CONSUMES_VARS,
    ...NEW_OP
  };
}
const CTX_REF = "CTX_REF_MARKER";
var CompilationJobKind;
(function(CompilationJobKind2) {
  CompilationJobKind2[CompilationJobKind2["Tmpl"] = 0] = "Tmpl";
  CompilationJobKind2[CompilationJobKind2["Host"] = 1] = "Host";
  CompilationJobKind2[CompilationJobKind2["Both"] = 2] = "Both";
})(CompilationJobKind || (CompilationJobKind = {}));
class CompilationJob {
  componentName;
  pool;
  compatibility;
  constructor(componentName, pool, compatibility) {
    this.componentName = componentName;
    this.pool = pool;
    this.compatibility = compatibility;
  }
  kind = CompilationJobKind.Both;
  /**
   * Generate a new unique `ir.XrefId` in this job.
   */
  allocateXrefId() {
    return this.nextXrefId++;
  }
  /**
   * Tracks the next `ir.XrefId` which can be assigned as template structures are ingested.
   */
  nextXrefId = 0;
}
class ComponentCompilationJob extends CompilationJob {
  relativeContextFilePath;
  i18nUseExternalIds;
  deferMeta;
  allDeferrableDepsFn;
  constructor(componentName, pool, compatibility, relativeContextFilePath, i18nUseExternalIds, deferMeta, allDeferrableDepsFn) {
    super(componentName, pool, compatibility);
    this.relativeContextFilePath = relativeContextFilePath;
    this.i18nUseExternalIds = i18nUseExternalIds;
    this.deferMeta = deferMeta;
    this.allDeferrableDepsFn = allDeferrableDepsFn;
    this.root = new ViewCompilationUnit(this, this.allocateXrefId(), null);
    this.views.set(this.root.xref, this.root);
  }
  kind = CompilationJobKind.Tmpl;
  fnSuffix = "Template";
  /**
   * The root view, representing the component's template.
   */
  root;
  views = /* @__PURE__ */ new Map();
  /**
   * Causes ngContentSelectors to be emitted, for content projection slots in the view. Possibly a
   * reference into the constant pool.
   */
  contentSelectors = null;
  /**
   * Add a `ViewCompilation` for a new embedded view to this compilation.
   */
  allocateView(parent) {
    const view = new ViewCompilationUnit(this, this.allocateXrefId(), parent);
    this.views.set(view.xref, view);
    return view;
  }
  get units() {
    return this.views.values();
  }
  /**
   * Add a constant `o.Expression` to the compilation and return its index in the `consts` array.
   */
  addConst(newConst, initializers) {
    for (let idx2 = 0; idx2 < this.consts.length; idx2++) {
      if (this.consts[idx2].isEquivalent(newConst)) {
        return idx2;
      }
    }
    const idx = this.consts.length;
    this.consts.push(newConst);
    if (initializers) {
      this.constsInitializers.push(...initializers);
    }
    return idx;
  }
  /**
   * Constant expressions used by operations within this component's compilation.
   *
   * This will eventually become the `consts` array in the component definition.
   */
  consts = [];
  /**
   * Initialization statements needed to set up the consts.
   */
  constsInitializers = [];
}
class CompilationUnit {
  xref;
  constructor(xref) {
    this.xref = xref;
  }
  /**
   * List of creation operations for this view.
   *
   * Creation operations may internally contain other operations, including update operations.
   */
  create = new OpList();
  /**
   * List of update operations for this view.
   */
  update = new OpList();
  /**
   * Name of the function which will be generated for this unit.
   *
   * May be `null` if not yet determined.
   */
  fnName = null;
  /**
   * Number of variable slots used within this view, or `null` if variables have not yet been
   * counted.
   */
  vars = null;
  /**
   * Iterate over all `ir.Op`s within this view.
   *
   * Some operations may have child operations, which this iterator will visit.
   */
  *ops() {
    for (const op of this.create) {
      yield op;
      if (op.kind === OpKind.Listener || op.kind === OpKind.TwoWayListener) {
        for (const listenerOp of op.handlerOps) {
          yield listenerOp;
        }
      }
    }
    for (const op of this.update) {
      yield op;
    }
  }
}
class ViewCompilationUnit extends CompilationUnit {
  job;
  parent;
  constructor(job, xref, parent) {
    super(xref);
    this.job = job;
    this.parent = parent;
  }
  /**
   * Map of declared variables available within this view to the property on the context object
   * which they alias.
   */
  contextVariables = /* @__PURE__ */ new Map();
  /**
   * Set of aliases available within this view. An alias is a variable whose provided expression is
   * inlined at every location it is used. It may also depend on context variables, by name.
   */
  aliases = /* @__PURE__ */ new Set();
  /**
   * Number of declaration slots used within this view, or `null` if slots have not yet been
   * allocated.
   */
  decls = null;
}
class HostBindingCompilationJob extends CompilationJob {
  constructor(componentName, pool, compatibility) {
    super(componentName, pool, compatibility);
    this.root = new HostBindingCompilationUnit(this);
  }
  kind = CompilationJobKind.Host;
  fnSuffix = "HostBindings";
  root;
  get units() {
    return [this.root];
  }
}
class HostBindingCompilationUnit extends CompilationUnit {
  job;
  constructor(job) {
    super(0);
    this.job = job;
  }
  /**
   * Much like an element can have attributes, so can a host binding function.
   */
  attributes = null;
}
function deleteAnyCasts(job) {
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      transformExpressionsInOp(op, removeAnys, VisitorContextFlag.None);
    }
  }
}
function removeAnys(e) {
  if (e instanceof InvokeFunctionExpr && e.fn instanceof LexicalReadExpr && e.fn.name === "$any") {
    if (e.args.length !== 1) {
      throw new Error("The $any builtin function expects exactly one argument.");
    }
    return e.args[0];
  }
  return e;
}
function applyI18nExpressions(job) {
  const i18nContexts = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.I18nContext) {
        i18nContexts.set(op.xref, op);
      }
    }
  }
  for (const unit of job.units) {
    for (const op of unit.update) {
      if (op.kind === OpKind.I18nExpression && needsApplication(i18nContexts, op)) {
        OpList.insertAfter(createI18nApplyOp(op.i18nOwner, op.handle, null), op);
      }
    }
  }
}
function needsApplication(i18nContexts, op) {
  if (op.next?.kind !== OpKind.I18nExpression) {
    return true;
  }
  const context = i18nContexts.get(op.context);
  const nextContext2 = i18nContexts.get(op.next.context);
  if (context === void 0) {
    throw new Error("AssertionError: expected an I18nContextOp to exist for the I18nExpressionOp's context");
  }
  if (nextContext2 === void 0) {
    throw new Error("AssertionError: expected an I18nContextOp to exist for the next I18nExpressionOp's context");
  }
  if (context.i18nBlock !== null) {
    if (context.i18nBlock !== nextContext2.i18nBlock) {
      return true;
    }
    return false;
  }
  if (op.i18nOwner !== op.next.i18nOwner) {
    return true;
  }
  return false;
}
function assignI18nSlotDependencies(job) {
  for (const unit of job.units) {
    let updateOp = unit.update.head;
    let i18nExpressionsInProgress = [];
    let state = null;
    for (const createOp of unit.create) {
      if (createOp.kind === OpKind.I18nStart) {
        state = {
          blockXref: createOp.xref,
          lastSlotConsumer: createOp.xref
        };
      } else if (createOp.kind === OpKind.I18nEnd) {
        for (const op of i18nExpressionsInProgress) {
          op.target = state.lastSlotConsumer;
          OpList.insertBefore(op, updateOp);
        }
        i18nExpressionsInProgress.length = 0;
        state = null;
      }
      if (hasConsumesSlotTrait(createOp)) {
        if (state !== null) {
          state.lastSlotConsumer = createOp.xref;
        }
        while (true) {
          if (updateOp.next === null) {
            break;
          }
          if (state !== null && updateOp.kind === OpKind.I18nExpression && updateOp.usage === I18nExpressionFor.I18nText && updateOp.i18nOwner === state.blockXref) {
            const opToRemove = updateOp;
            updateOp = updateOp.next;
            OpList.remove(opToRemove);
            i18nExpressionsInProgress.push(opToRemove);
            continue;
          }
          if (hasDependsOnSlotContextTrait(updateOp) && updateOp.target !== createOp.xref) {
            break;
          }
          updateOp = updateOp.next;
        }
      }
    }
  }
}
function createOpXrefMap(unit) {
  const map = /* @__PURE__ */ new Map();
  for (const op of unit.create) {
    if (!hasConsumesSlotTrait(op)) {
      continue;
    }
    map.set(op.xref, op);
    if (op.kind === OpKind.RepeaterCreate && op.emptyView !== null) {
      map.set(op.emptyView, op);
    }
  }
  return map;
}
function extractAttributes(job) {
  for (const unit of job.units) {
    const elements = createOpXrefMap(unit);
    for (const op of unit.ops()) {
      switch (op.kind) {
        case OpKind.Attribute:
          extractAttributeOp(unit, op, elements);
          break;
        case OpKind.Property:
          if (!op.isAnimationTrigger) {
            let bindingKind;
            if (op.i18nMessage !== null && op.templateKind === null) {
              bindingKind = BindingKind.I18n;
            } else if (op.isStructuralTemplateAttribute) {
              bindingKind = BindingKind.Template;
            } else {
              bindingKind = BindingKind.Property;
            }
            OpList.insertBefore(
              // Deliberately null i18nMessage value
              createExtractedAttributeOp(
                op.target,
                bindingKind,
                null,
                op.name,
                /* expression */
                null,
                /* i18nContext */
                null,
                /* i18nMessage */
                null,
                op.securityContext
              ),
              lookupElement$2(elements, op.target)
            );
          }
          break;
        case OpKind.TwoWayProperty:
          OpList.insertBefore(createExtractedAttributeOp(
            op.target,
            BindingKind.TwoWayProperty,
            null,
            op.name,
            /* expression */
            null,
            /* i18nContext */
            null,
            /* i18nMessage */
            null,
            op.securityContext
          ), lookupElement$2(elements, op.target));
          break;
        case OpKind.StyleProp:
        case OpKind.ClassProp:
          if (unit.job.compatibility === CompatibilityMode.TemplateDefinitionBuilder && op.expression instanceof EmptyExpr) {
            OpList.insertBefore(createExtractedAttributeOp(
              op.target,
              BindingKind.Property,
              null,
              op.name,
              /* expression */
              null,
              /* i18nContext */
              null,
              /* i18nMessage */
              null,
              SecurityContext.STYLE
            ), lookupElement$2(elements, op.target));
          }
          break;
        case OpKind.Listener:
          if (!op.isAnimationListener) {
            const extractedAttributeOp = createExtractedAttributeOp(
              op.target,
              BindingKind.Property,
              null,
              op.name,
              /* expression */
              null,
              /* i18nContext */
              null,
              /* i18nMessage */
              null,
              SecurityContext.NONE
            );
            if (job.kind === CompilationJobKind.Host) {
              if (job.compatibility) {
                break;
              }
              unit.create.push(extractedAttributeOp);
            } else {
              OpList.insertBefore(extractedAttributeOp, lookupElement$2(elements, op.target));
            }
          }
          break;
        case OpKind.TwoWayListener:
          if (job.kind !== CompilationJobKind.Host) {
            const extractedAttributeOp = createExtractedAttributeOp(
              op.target,
              BindingKind.Property,
              null,
              op.name,
              /* expression */
              null,
              /* i18nContext */
              null,
              /* i18nMessage */
              null,
              SecurityContext.NONE
            );
            OpList.insertBefore(extractedAttributeOp, lookupElement$2(elements, op.target));
          }
          break;
      }
    }
  }
}
function lookupElement$2(elements, xref) {
  const el = elements.get(xref);
  if (el === void 0) {
    throw new Error("All attributes should have an element-like target.");
  }
  return el;
}
function extractAttributeOp(unit, op, elements) {
  if (op.expression instanceof Interpolation) {
    return;
  }
  let extractable = op.isTextAttribute || op.expression.isConstant();
  if (unit.job.compatibility === CompatibilityMode.TemplateDefinitionBuilder) {
    extractable &&= op.isTextAttribute;
  }
  if (extractable) {
    const extractedAttributeOp = createExtractedAttributeOp(op.target, op.isStructuralTemplateAttribute ? BindingKind.Template : BindingKind.Attribute, op.namespace, op.name, op.expression, op.i18nContext, op.i18nMessage, op.securityContext);
    if (unit.job.kind === CompilationJobKind.Host) {
      unit.create.push(extractedAttributeOp);
    } else {
      const ownerOp = lookupElement$2(elements, op.target);
      OpList.insertBefore(extractedAttributeOp, ownerOp);
    }
    OpList.remove(op);
  }
}
function lookupElement$1(elements, xref) {
  const el = elements.get(xref);
  if (el === void 0) {
    throw new Error("All attributes should have an element-like target.");
  }
  return el;
}
function specializeBindings(job) {
  const elements = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (!isElementOrContainerOp(op)) {
        continue;
      }
      elements.set(op.xref, op);
    }
  }
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      if (op.kind !== OpKind.Binding) {
        continue;
      }
      switch (op.bindingKind) {
        case BindingKind.Attribute:
          if (op.name === "ngNonBindable") {
            OpList.remove(op);
            const target = lookupElement$1(elements, op.target);
            target.nonBindable = true;
          } else {
            const [namespace, name] = splitNsName(op.name);
            OpList.replace(op, createAttributeOp(op.target, namespace, name, op.expression, op.securityContext, op.isTextAttribute, op.isStructuralTemplateAttribute, op.templateKind, op.i18nMessage, op.sourceSpan));
          }
          break;
        case BindingKind.Property:
        case BindingKind.Animation:
          if (job.kind === CompilationJobKind.Host) {
            OpList.replace(op, createHostPropertyOp(op.name, op.expression, op.bindingKind === BindingKind.Animation, op.i18nContext, op.securityContext, op.sourceSpan));
          } else {
            OpList.replace(op, createPropertyOp(op.target, op.name, op.expression, op.bindingKind === BindingKind.Animation, op.securityContext, op.isStructuralTemplateAttribute, op.templateKind, op.i18nContext, op.i18nMessage, op.sourceSpan));
          }
          break;
        case BindingKind.TwoWayProperty:
          if (!(op.expression instanceof Expression)) {
            throw new Error(`Expected value of two-way property binding "${op.name}" to be an expression`);
          }
          OpList.replace(op, createTwoWayPropertyOp(op.target, op.name, op.expression, op.securityContext, op.isStructuralTemplateAttribute, op.templateKind, op.i18nContext, op.i18nMessage, op.sourceSpan));
          break;
        case BindingKind.I18n:
        case BindingKind.ClassName:
        case BindingKind.StyleProperty:
          throw new Error(`Unhandled binding of kind ${BindingKind[op.bindingKind]}`);
      }
    }
  }
}
const CHAINABLE = /* @__PURE__ */ new Set([
  Identifiers.attribute,
  Identifiers.classProp,
  Identifiers.element,
  Identifiers.elementContainer,
  Identifiers.elementContainerEnd,
  Identifiers.elementContainerStart,
  Identifiers.elementEnd,
  Identifiers.elementStart,
  Identifiers.hostProperty,
  Identifiers.i18nExp,
  Identifiers.listener,
  Identifiers.listener,
  Identifiers.property,
  Identifiers.styleProp,
  Identifiers.stylePropInterpolate1,
  Identifiers.stylePropInterpolate2,
  Identifiers.stylePropInterpolate3,
  Identifiers.stylePropInterpolate4,
  Identifiers.stylePropInterpolate5,
  Identifiers.stylePropInterpolate6,
  Identifiers.stylePropInterpolate7,
  Identifiers.stylePropInterpolate8,
  Identifiers.stylePropInterpolateV,
  Identifiers.syntheticHostListener,
  Identifiers.syntheticHostProperty,
  Identifiers.templateCreate,
  Identifiers.twoWayProperty,
  Identifiers.twoWayListener,
  Identifiers.declareLet
]);
const MAX_CHAIN_LENGTH = 256;
function chain(job) {
  for (const unit of job.units) {
    chainOperationsInList(unit.create);
    chainOperationsInList(unit.update);
  }
}
function chainOperationsInList(opList) {
  let chain2 = null;
  for (const op of opList) {
    if (op.kind !== OpKind.Statement || !(op.statement instanceof ExpressionStatement)) {
      chain2 = null;
      continue;
    }
    if (!(op.statement.expr instanceof InvokeFunctionExpr) || !(op.statement.expr.fn instanceof ExternalExpr)) {
      chain2 = null;
      continue;
    }
    const instruction = op.statement.expr.fn.value;
    if (!CHAINABLE.has(instruction)) {
      chain2 = null;
      continue;
    }
    if (chain2 !== null && chain2.instruction === instruction && chain2.length < MAX_CHAIN_LENGTH) {
      const expression = chain2.expression.callFn(op.statement.expr.args, op.statement.expr.sourceSpan, op.statement.expr.pure);
      chain2.expression = expression;
      chain2.op.statement = expression.toStmt();
      chain2.length++;
      OpList.remove(op);
    } else {
      chain2 = {
        op,
        instruction,
        expression: op.statement.expr,
        length: 1
      };
    }
  }
}
function collapseSingletonInterpolations(job) {
  for (const unit of job.units) {
    for (const op of unit.update) {
      const eligibleOpKind = op.kind === OpKind.Attribute;
      if (eligibleOpKind && op.expression instanceof Interpolation && op.expression.strings.length === 2 && op.expression.strings.every((s) => s === "")) {
        op.expression = op.expression.expressions[0];
      }
    }
  }
}
function generateConditionalExpressions(job) {
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      if (op.kind !== OpKind.Conditional) {
        continue;
      }
      let test;
      const defaultCase = op.conditions.findIndex((cond) => cond.expr === null);
      if (defaultCase >= 0) {
        const slot = op.conditions.splice(defaultCase, 1)[0].targetSlot;
        test = new SlotLiteralExpr(slot);
      } else {
        test = literal(-1);
      }
      let tmp = op.test == null ? null : new AssignTemporaryExpr(op.test, job.allocateXrefId());
      for (let i = op.conditions.length - 1; i >= 0; i--) {
        let conditionalCase = op.conditions[i];
        if (conditionalCase.expr === null) {
          continue;
        }
        if (tmp !== null) {
          const useTmp = i === 0 ? tmp : new ReadTemporaryExpr(tmp.xref);
          conditionalCase.expr = new BinaryOperatorExpr(BinaryOperator.Identical, useTmp, conditionalCase.expr);
        } else if (conditionalCase.alias !== null) {
          const caseExpressionTemporaryXref = job.allocateXrefId();
          conditionalCase.expr = new AssignTemporaryExpr(conditionalCase.expr, caseExpressionTemporaryXref);
          op.contextValue = new ReadTemporaryExpr(caseExpressionTemporaryXref);
        }
        test = new ConditionalExpr(conditionalCase.expr, new SlotLiteralExpr(conditionalCase.targetSlot), test);
      }
      op.processed = test;
      op.conditions = [];
    }
  }
}
const BINARY_OPERATORS = /* @__PURE__ */ new Map([
  ["&&", BinaryOperator.And],
  [">", BinaryOperator.Bigger],
  [">=", BinaryOperator.BiggerEquals],
  ["|", BinaryOperator.BitwiseOr],
  ["&", BinaryOperator.BitwiseAnd],
  ["/", BinaryOperator.Divide],
  ["==", BinaryOperator.Equals],
  ["===", BinaryOperator.Identical],
  ["<", BinaryOperator.Lower],
  ["<=", BinaryOperator.LowerEquals],
  ["-", BinaryOperator.Minus],
  ["%", BinaryOperator.Modulo],
  ["*", BinaryOperator.Multiply],
  ["!=", BinaryOperator.NotEquals],
  ["!==", BinaryOperator.NotIdentical],
  ["??", BinaryOperator.NullishCoalesce],
  ["||", BinaryOperator.Or],
  ["+", BinaryOperator.Plus]
]);
function namespaceForKey(namespacePrefixKey) {
  const NAMESPACES = /* @__PURE__ */ new Map([
    ["svg", Namespace.SVG],
    ["math", Namespace.Math]
  ]);
  if (namespacePrefixKey === null) {
    return Namespace.HTML;
  }
  return NAMESPACES.get(namespacePrefixKey) ?? Namespace.HTML;
}
function keyForNamespace(namespace) {
  const NAMESPACES = /* @__PURE__ */ new Map([
    ["svg", Namespace.SVG],
    ["math", Namespace.Math]
  ]);
  for (const [k, n] of NAMESPACES.entries()) {
    if (n === namespace) {
      return k;
    }
  }
  return null;
}
function prefixWithNamespace(strippedTag, namespace) {
  if (namespace === Namespace.HTML) {
    return strippedTag;
  }
  return `:${keyForNamespace(namespace)}:${strippedTag}`;
}
function literalOrArrayLiteral(value) {
  if (Array.isArray(value)) {
    return literalArr(value.map(literalOrArrayLiteral));
  }
  return literal(value);
}
function collectElementConsts(job) {
  const allElementAttributes = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.ExtractedAttribute) {
        const attributes = allElementAttributes.get(op.target) || new ElementAttributes(job.compatibility);
        allElementAttributes.set(op.target, attributes);
        attributes.add(op.bindingKind, op.name, op.expression, op.namespace, op.trustedValueFn);
        OpList.remove(op);
      }
    }
  }
  if (job instanceof ComponentCompilationJob) {
    for (const unit of job.units) {
      for (const op of unit.create) {
        if (op.kind == OpKind.Projection) {
          const attributes = allElementAttributes.get(op.xref);
          if (attributes !== void 0) {
            const attrArray = serializeAttributes(attributes);
            if (attrArray.entries.length > 0) {
              op.attributes = attrArray;
            }
          }
        } else if (isElementOrContainerOp(op)) {
          op.attributes = getConstIndex(job, allElementAttributes, op.xref);
          if (op.kind === OpKind.RepeaterCreate && op.emptyView !== null) {
            op.emptyAttributes = getConstIndex(job, allElementAttributes, op.emptyView);
          }
        }
      }
    }
  } else if (job instanceof HostBindingCompilationJob) {
    for (const [xref, attributes] of allElementAttributes.entries()) {
      if (xref !== job.root.xref) {
        throw new Error(`An attribute would be const collected into the host binding's template function, but is not associated with the root xref.`);
      }
      const attrArray = serializeAttributes(attributes);
      if (attrArray.entries.length > 0) {
        job.root.attributes = attrArray;
      }
    }
  }
}
function getConstIndex(job, allElementAttributes, xref) {
  const attributes = allElementAttributes.get(xref);
  if (attributes !== void 0) {
    const attrArray = serializeAttributes(attributes);
    if (attrArray.entries.length > 0) {
      return job.addConst(attrArray);
    }
  }
  return null;
}
const FLYWEIGHT_ARRAY = Object.freeze([]);
class ElementAttributes {
  compatibility;
  known = /* @__PURE__ */ new Map();
  byKind = /* @__PURE__ */ new Map();
  propertyBindings = null;
  projectAs = null;
  get attributes() {
    return this.byKind.get(BindingKind.Attribute) ?? FLYWEIGHT_ARRAY;
  }
  get classes() {
    return this.byKind.get(BindingKind.ClassName) ?? FLYWEIGHT_ARRAY;
  }
  get styles() {
    return this.byKind.get(BindingKind.StyleProperty) ?? FLYWEIGHT_ARRAY;
  }
  get bindings() {
    return this.propertyBindings ?? FLYWEIGHT_ARRAY;
  }
  get template() {
    return this.byKind.get(BindingKind.Template) ?? FLYWEIGHT_ARRAY;
  }
  get i18n() {
    return this.byKind.get(BindingKind.I18n) ?? FLYWEIGHT_ARRAY;
  }
  constructor(compatibility) {
    this.compatibility = compatibility;
  }
  isKnown(kind, name) {
    const nameToValue = this.known.get(kind) ?? /* @__PURE__ */ new Set();
    this.known.set(kind, nameToValue);
    if (nameToValue.has(name)) {
      return true;
    }
    nameToValue.add(name);
    return false;
  }
  add(kind, name, value, namespace, trustedValueFn) {
    const allowDuplicates = this.compatibility === CompatibilityMode.TemplateDefinitionBuilder && (kind === BindingKind.Attribute || kind === BindingKind.ClassName || kind === BindingKind.StyleProperty);
    if (!allowDuplicates && this.isKnown(kind, name)) {
      return;
    }
    if (name === "ngProjectAs") {
      if (value === null || !(value instanceof LiteralExpr) || value.value == null || typeof value.value?.toString() !== "string") {
        throw Error("ngProjectAs must have a string literal value");
      }
      this.projectAs = value.value.toString();
    }
    const array = this.arrayFor(kind);
    array.push(...getAttributeNameLiterals(namespace, name));
    if (kind === BindingKind.Attribute || kind === BindingKind.StyleProperty) {
      if (value === null) {
        throw Error("Attribute, i18n attribute, & style element attributes must have a value");
      }
      if (trustedValueFn !== null) {
        if (!isStringLiteral(value)) {
          throw Error("AssertionError: extracted attribute value should be string literal");
        }
        array.push(taggedTemplate(trustedValueFn, new TemplateLiteral([new TemplateLiteralElement(value.value)], []), void 0, value.sourceSpan));
      } else {
        array.push(value);
      }
    }
  }
  arrayFor(kind) {
    if (kind === BindingKind.Property || kind === BindingKind.TwoWayProperty) {
      this.propertyBindings ??= [];
      return this.propertyBindings;
    } else {
      if (!this.byKind.has(kind)) {
        this.byKind.set(kind, []);
      }
      return this.byKind.get(kind);
    }
  }
}
function getAttributeNameLiterals(namespace, name) {
  const nameLiteral = literal(name);
  if (namespace) {
    return [literal(
      0
      /* core.AttributeMarker.NamespaceURI */
    ), literal(namespace), nameLiteral];
  }
  return [nameLiteral];
}
function serializeAttributes({ attributes, bindings, classes, i18n: i18n2, projectAs, styles, template: template2 }) {
  const attrArray = [...attributes];
  if (projectAs !== null) {
    const parsedR3Selector = parseSelectorToR3Selector(projectAs)[0];
    attrArray.push(literal(
      5
      /* core.AttributeMarker.ProjectAs */
    ), literalOrArrayLiteral(parsedR3Selector));
  }
  if (classes.length > 0) {
    attrArray.push(literal(
      1
      /* core.AttributeMarker.Classes */
    ), ...classes);
  }
  if (styles.length > 0) {
    attrArray.push(literal(
      2
      /* core.AttributeMarker.Styles */
    ), ...styles);
  }
  if (bindings.length > 0) {
    attrArray.push(literal(
      3
      /* core.AttributeMarker.Bindings */
    ), ...bindings);
  }
  if (template2.length > 0) {
    attrArray.push(literal(
      4
      /* core.AttributeMarker.Template */
    ), ...template2);
  }
  if (i18n2.length > 0) {
    attrArray.push(literal(
      6
      /* core.AttributeMarker.I18n */
    ), ...i18n2);
  }
  return literalArr(attrArray);
}
function convertI18nBindings(job) {
  const i18nAttributesByElem = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.I18nAttributes) {
        i18nAttributesByElem.set(op.target, op);
      }
    }
    for (const op of unit.update) {
      switch (op.kind) {
        case OpKind.Property:
        case OpKind.Attribute:
          if (op.i18nContext === null) {
            continue;
          }
          if (!(op.expression instanceof Interpolation)) {
            continue;
          }
          const i18nAttributesForElem = i18nAttributesByElem.get(op.target);
          if (i18nAttributesForElem === void 0) {
            throw new Error("AssertionError: An i18n attribute binding instruction requires the owning element to have an I18nAttributes create instruction");
          }
          if (i18nAttributesForElem.target !== op.target) {
            throw new Error("AssertionError: Expected i18nAttributes target element to match binding target element");
          }
          const ops = [];
          for (let i = 0; i < op.expression.expressions.length; i++) {
            const expr = op.expression.expressions[i];
            if (op.expression.i18nPlaceholders.length !== op.expression.expressions.length) {
              throw new Error(`AssertionError: An i18n attribute binding instruction requires the same number of expressions and placeholders, but found ${op.expression.i18nPlaceholders.length} placeholders and ${op.expression.expressions.length} expressions`);
            }
            ops.push(createI18nExpressionOp(op.i18nContext, i18nAttributesForElem.target, i18nAttributesForElem.xref, i18nAttributesForElem.handle, expr, null, op.expression.i18nPlaceholders[i], I18nParamResolutionTime.Creation, I18nExpressionFor.I18nAttribute, op.name, op.sourceSpan));
          }
          OpList.replaceWithMany(op, ops);
          break;
      }
    }
  }
}
function resolveDeferDepsFns(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.Defer) {
        if (op.resolverFn !== null) {
          continue;
        }
        if (op.ownResolverFn !== null) {
          if (op.handle.slot === null) {
            throw new Error("AssertionError: slot must be assigned before extracting defer deps functions");
          }
          const fullPathName = unit.fnName?.replace("_Template", "");
          op.resolverFn = job.pool.getSharedFunctionReference(
            op.ownResolverFn,
            `${fullPathName}_Defer_${op.handle.slot}_DepsFn`,
            /* Don't use unique names for TDB compatibility */
            false
          );
        }
      }
    }
  }
}
function createI18nContexts(job) {
  const attrContextByMessage = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      switch (op.kind) {
        case OpKind.Binding:
        case OpKind.Property:
        case OpKind.Attribute:
        case OpKind.ExtractedAttribute:
          if (op.i18nMessage === null) {
            continue;
          }
          if (!attrContextByMessage.has(op.i18nMessage)) {
            const i18nContext = createI18nContextOp(I18nContextKind.Attr, job.allocateXrefId(), null, op.i18nMessage, null);
            unit.create.push(i18nContext);
            attrContextByMessage.set(op.i18nMessage, i18nContext.xref);
          }
          op.i18nContext = attrContextByMessage.get(op.i18nMessage);
          break;
      }
    }
  }
  const blockContextByI18nBlock = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nStart:
          if (op.xref === op.root) {
            const contextOp = createI18nContextOp(I18nContextKind.RootI18n, job.allocateXrefId(), op.xref, op.message, null);
            unit.create.push(contextOp);
            op.context = contextOp.xref;
            blockContextByI18nBlock.set(op.xref, contextOp);
          }
          break;
      }
    }
  }
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.I18nStart && op.xref !== op.root) {
        const rootContext = blockContextByI18nBlock.get(op.root);
        if (rootContext === void 0) {
          throw Error("AssertionError: Root i18n block i18n context should have been created.");
        }
        op.context = rootContext.xref;
        blockContextByI18nBlock.set(op.xref, rootContext);
      }
    }
  }
  let currentI18nOp = null;
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nStart:
          currentI18nOp = op;
          break;
        case OpKind.I18nEnd:
          currentI18nOp = null;
          break;
        case OpKind.IcuStart:
          if (currentI18nOp === null) {
            throw Error("AssertionError: Unexpected ICU outside of an i18n block.");
          }
          if (op.message.id !== currentI18nOp.message.id) {
            const contextOp = createI18nContextOp(I18nContextKind.Icu, job.allocateXrefId(), currentI18nOp.root, op.message, null);
            unit.create.push(contextOp);
            op.context = contextOp.xref;
          } else {
            op.context = currentI18nOp.context;
            blockContextByI18nBlock.get(currentI18nOp.xref).contextKind = I18nContextKind.Icu;
          }
          break;
      }
    }
  }
}
function deduplicateTextBindings(job) {
  const seen = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.update.reversed()) {
      if (op.kind === OpKind.Binding && op.isTextAttribute) {
        const seenForElement = seen.get(op.target) || /* @__PURE__ */ new Set();
        if (seenForElement.has(op.name)) {
          if (job.compatibility === CompatibilityMode.TemplateDefinitionBuilder) {
            if (op.name === "style" || op.name === "class") {
              OpList.remove(op);
            }
          }
        }
        seenForElement.add(op.name);
        seen.set(op.target, seenForElement);
      }
    }
  }
}
function configureDeferInstructions(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind !== OpKind.Defer) {
        continue;
      }
      if (op.placeholderMinimumTime !== null) {
        op.placeholderConfig = new ConstCollectedExpr(literalOrArrayLiteral([op.placeholderMinimumTime]));
      }
      if (op.loadingMinimumTime !== null || op.loadingAfterTime !== null) {
        op.loadingConfig = new ConstCollectedExpr(literalOrArrayLiteral([op.loadingMinimumTime, op.loadingAfterTime]));
      }
    }
  }
}
function resolveDeferTargetNames(job) {
  const scopes = /* @__PURE__ */ new Map();
  function getScopeForView2(view) {
    if (scopes.has(view.xref)) {
      return scopes.get(view.xref);
    }
    const scope = new Scope$1();
    for (const op of view.create) {
      if (!isElementOrContainerOp(op) || op.localRefs === null) {
        continue;
      }
      if (!Array.isArray(op.localRefs)) {
        throw new Error("LocalRefs were already processed, but were needed to resolve defer targets.");
      }
      for (const ref of op.localRefs) {
        if (ref.target !== "") {
          continue;
        }
        scope.targets.set(ref.name, { xref: op.xref, slot: op.handle });
      }
    }
    scopes.set(view.xref, scope);
    return scope;
  }
  function resolveTrigger(deferOwnerView, op, placeholderView) {
    switch (op.trigger.kind) {
      case DeferTriggerKind.Idle:
      case DeferTriggerKind.Never:
      case DeferTriggerKind.Immediate:
      case DeferTriggerKind.Timer:
        return;
      case DeferTriggerKind.Hover:
      case DeferTriggerKind.Interaction:
      case DeferTriggerKind.Viewport:
        if (op.trigger.targetName === null) {
          if (placeholderView === null) {
            throw new Error("defer on trigger with no target name must have a placeholder block");
          }
          const placeholder = job.views.get(placeholderView);
          if (placeholder == void 0) {
            throw new Error("AssertionError: could not find placeholder view for defer on trigger");
          }
          for (const placeholderOp of placeholder.create) {
            if (hasConsumesSlotTrait(placeholderOp) && (isElementOrContainerOp(placeholderOp) || placeholderOp.kind === OpKind.Projection)) {
              op.trigger.targetXref = placeholderOp.xref;
              op.trigger.targetView = placeholderView;
              op.trigger.targetSlotViewSteps = -1;
              op.trigger.targetSlot = placeholderOp.handle;
              return;
            }
          }
          return;
        }
        let view = placeholderView !== null ? job.views.get(placeholderView) : deferOwnerView;
        let step = placeholderView !== null ? -1 : 0;
        while (view !== null) {
          const scope = getScopeForView2(view);
          if (scope.targets.has(op.trigger.targetName)) {
            const { xref, slot } = scope.targets.get(op.trigger.targetName);
            op.trigger.targetXref = xref;
            op.trigger.targetView = view.xref;
            op.trigger.targetSlotViewSteps = step;
            op.trigger.targetSlot = slot;
            return;
          }
          view = view.parent !== null ? job.views.get(view.parent) : null;
          step++;
        }
        break;
      default:
        throw new Error(`Trigger kind ${op.trigger.kind} not handled`);
    }
  }
  for (const unit of job.units) {
    const defers = /* @__PURE__ */ new Map();
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.Defer:
          defers.set(op.xref, op);
          break;
        case OpKind.DeferOn:
          const deferOp = defers.get(op.defer);
          resolveTrigger(unit, op, op.modifier === "hydrate" ? deferOp.mainView : deferOp.placeholderView);
          break;
      }
    }
  }
}
class Scope$1 {
  targets = /* @__PURE__ */ new Map();
}
const REPLACEMENTS = /* @__PURE__ */ new Map([
  [OpKind.ElementEnd, [OpKind.ElementStart, OpKind.Element]],
  [OpKind.ContainerEnd, [OpKind.ContainerStart, OpKind.Container]],
  [OpKind.I18nEnd, [OpKind.I18nStart, OpKind.I18n]]
]);
const IGNORED_OP_KINDS = /* @__PURE__ */ new Set([OpKind.Pipe]);
function collapseEmptyInstructions(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      const opReplacements = REPLACEMENTS.get(op.kind);
      if (opReplacements === void 0) {
        continue;
      }
      const [startKind, mergedKind] = opReplacements;
      let prevOp = op.prev;
      while (prevOp !== null && IGNORED_OP_KINDS.has(prevOp.kind)) {
        prevOp = prevOp.prev;
      }
      if (prevOp !== null && prevOp.kind === startKind) {
        prevOp.kind = mergedKind;
        OpList.remove(op);
      }
    }
  }
}
function expandSafeReads(job) {
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      transformExpressionsInOp(op, (e) => safeTransform(e, { job }), VisitorContextFlag.None);
      transformExpressionsInOp(op, ternaryTransform, VisitorContextFlag.None);
    }
  }
}
[
  InvokeFunctionExpr,
  LiteralArrayExpr,
  LiteralMapExpr,
  SafeInvokeFunctionExpr,
  PipeBindingExpr
].map((e) => e.constructor.name);
function needsTemporaryInSafeAccess(e) {
  if (e instanceof UnaryOperatorExpr) {
    return needsTemporaryInSafeAccess(e.expr);
  } else if (e instanceof BinaryOperatorExpr) {
    return needsTemporaryInSafeAccess(e.lhs) || needsTemporaryInSafeAccess(e.rhs);
  } else if (e instanceof ConditionalExpr) {
    if (e.falseCase && needsTemporaryInSafeAccess(e.falseCase))
      return true;
    return needsTemporaryInSafeAccess(e.condition) || needsTemporaryInSafeAccess(e.trueCase);
  } else if (e instanceof NotExpr) {
    return needsTemporaryInSafeAccess(e.condition);
  } else if (e instanceof AssignTemporaryExpr) {
    return needsTemporaryInSafeAccess(e.expr);
  } else if (e instanceof ReadPropExpr) {
    return needsTemporaryInSafeAccess(e.receiver);
  } else if (e instanceof ReadKeyExpr) {
    return needsTemporaryInSafeAccess(e.receiver) || needsTemporaryInSafeAccess(e.index);
  }
  return e instanceof InvokeFunctionExpr || e instanceof LiteralArrayExpr || e instanceof LiteralMapExpr || e instanceof SafeInvokeFunctionExpr || e instanceof PipeBindingExpr;
}
function temporariesIn(e) {
  const temporaries = /* @__PURE__ */ new Set();
  transformExpressionsInExpression(e, (e2) => {
    if (e2 instanceof AssignTemporaryExpr) {
      temporaries.add(e2.xref);
    }
    return e2;
  }, VisitorContextFlag.None);
  return temporaries;
}
function eliminateTemporaryAssignments(e, tmps, ctx) {
  transformExpressionsInExpression(e, (e2) => {
    if (e2 instanceof AssignTemporaryExpr && tmps.has(e2.xref)) {
      const read = new ReadTemporaryExpr(e2.xref);
      return ctx.job.compatibility === CompatibilityMode.TemplateDefinitionBuilder ? new AssignTemporaryExpr(read, read.xref) : read;
    }
    return e2;
  }, VisitorContextFlag.None);
  return e;
}
function safeTernaryWithTemporary(guard, body, ctx) {
  let result;
  if (needsTemporaryInSafeAccess(guard)) {
    const xref = ctx.job.allocateXrefId();
    result = [new AssignTemporaryExpr(guard, xref), new ReadTemporaryExpr(xref)];
  } else {
    result = [guard, guard.clone()];
    eliminateTemporaryAssignments(result[1], temporariesIn(result[0]), ctx);
  }
  return new SafeTernaryExpr(result[0], body(result[1]));
}
function isSafeAccessExpression(e) {
  return e instanceof SafePropertyReadExpr || e instanceof SafeKeyedReadExpr || e instanceof SafeInvokeFunctionExpr;
}
function isUnsafeAccessExpression(e) {
  return e instanceof ReadPropExpr || e instanceof ReadKeyExpr || e instanceof InvokeFunctionExpr;
}
function isAccessExpression(e) {
  return isSafeAccessExpression(e) || isUnsafeAccessExpression(e);
}
function deepestSafeTernary(e) {
  if (isAccessExpression(e) && e.receiver instanceof SafeTernaryExpr) {
    let st = e.receiver;
    while (st.expr instanceof SafeTernaryExpr) {
      st = st.expr;
    }
    return st;
  }
  return null;
}
function safeTransform(e, ctx) {
  if (!isAccessExpression(e)) {
    return e;
  }
  const dst = deepestSafeTernary(e);
  if (dst) {
    if (e instanceof InvokeFunctionExpr) {
      dst.expr = dst.expr.callFn(e.args);
      return e.receiver;
    }
    if (e instanceof ReadPropExpr) {
      dst.expr = dst.expr.prop(e.name);
      return e.receiver;
    }
    if (e instanceof ReadKeyExpr) {
      dst.expr = dst.expr.key(e.index);
      return e.receiver;
    }
    if (e instanceof SafeInvokeFunctionExpr) {
      dst.expr = safeTernaryWithTemporary(dst.expr, (r) => r.callFn(e.args), ctx);
      return e.receiver;
    }
    if (e instanceof SafePropertyReadExpr) {
      dst.expr = safeTernaryWithTemporary(dst.expr, (r) => r.prop(e.name), ctx);
      return e.receiver;
    }
    if (e instanceof SafeKeyedReadExpr) {
      dst.expr = safeTernaryWithTemporary(dst.expr, (r) => r.key(e.index), ctx);
      return e.receiver;
    }
  } else {
    if (e instanceof SafeInvokeFunctionExpr) {
      return safeTernaryWithTemporary(e.receiver, (r) => r.callFn(e.args), ctx);
    }
    if (e instanceof SafePropertyReadExpr) {
      return safeTernaryWithTemporary(e.receiver, (r) => r.prop(e.name), ctx);
    }
    if (e instanceof SafeKeyedReadExpr) {
      return safeTernaryWithTemporary(e.receiver, (r) => r.key(e.index), ctx);
    }
  }
  return e;
}
function ternaryTransform(e) {
  if (!(e instanceof SafeTernaryExpr)) {
    return e;
  }
  return new ConditionalExpr(new BinaryOperatorExpr(BinaryOperator.Equals, e.guard, NULL_EXPR), NULL_EXPR, e.expr);
}
const ESCAPE$1 = "�";
const ELEMENT_MARKER = "#";
const TEMPLATE_MARKER = "*";
const TAG_CLOSE_MARKER = "/";
const CONTEXT_MARKER = ":";
const LIST_START_MARKER = "[";
const LIST_END_MARKER = "]";
const LIST_DELIMITER = "|";
function extractI18nMessages(job) {
  const i18nMessagesByContext = /* @__PURE__ */ new Map();
  const i18nBlocks = /* @__PURE__ */ new Map();
  const i18nContexts = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nContext:
          const i18nMessageOp = createI18nMessage(job, op);
          unit.create.push(i18nMessageOp);
          i18nMessagesByContext.set(op.xref, i18nMessageOp);
          i18nContexts.set(op.xref, op);
          break;
        case OpKind.I18nStart:
          i18nBlocks.set(op.xref, op);
          break;
      }
    }
  }
  let currentIcu = null;
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.IcuStart:
          currentIcu = op;
          OpList.remove(op);
          const icuContext = i18nContexts.get(op.context);
          if (icuContext.contextKind !== I18nContextKind.Icu) {
            continue;
          }
          const i18nBlock = i18nBlocks.get(icuContext.i18nBlock);
          if (i18nBlock.context === icuContext.xref) {
            continue;
          }
          const rootI18nBlock = i18nBlocks.get(i18nBlock.root);
          const rootMessage = i18nMessagesByContext.get(rootI18nBlock.context);
          if (rootMessage === void 0) {
            throw Error("AssertionError: ICU sub-message should belong to a root message.");
          }
          const subMessage = i18nMessagesByContext.get(icuContext.xref);
          subMessage.messagePlaceholder = op.messagePlaceholder;
          rootMessage.subMessages.push(subMessage.xref);
          break;
        case OpKind.IcuEnd:
          currentIcu = null;
          OpList.remove(op);
          break;
        case OpKind.IcuPlaceholder:
          if (currentIcu === null || currentIcu.context == null) {
            throw Error("AssertionError: Unexpected ICU placeholder outside of i18n context");
          }
          const msg = i18nMessagesByContext.get(currentIcu.context);
          msg.postprocessingParams.set(op.name, literal(formatIcuPlaceholder(op)));
          OpList.remove(op);
          break;
      }
    }
  }
}
function createI18nMessage(job, context, messagePlaceholder) {
  let formattedParams = formatParams(context.params);
  const formattedPostprocessingParams = formatParams(context.postprocessingParams);
  let needsPostprocessing = [...context.params.values()].some((v) => v.length > 1);
  return createI18nMessageOp(job.allocateXrefId(), context.xref, context.i18nBlock, context.message, null, formattedParams, formattedPostprocessingParams, needsPostprocessing);
}
function formatIcuPlaceholder(op) {
  if (op.strings.length !== op.expressionPlaceholders.length + 1) {
    throw Error(`AssertionError: Invalid ICU placeholder with ${op.strings.length} strings and ${op.expressionPlaceholders.length} expressions`);
  }
  const values = op.expressionPlaceholders.map(formatValue);
  return op.strings.flatMap((str, i) => [str, values[i] || ""]).join("");
}
function formatParams(params) {
  const formattedParams = /* @__PURE__ */ new Map();
  for (const [placeholder, placeholderValues] of params) {
    const serializedValues = formatParamValues(placeholderValues);
    if (serializedValues !== null) {
      formattedParams.set(placeholder, literal(serializedValues));
    }
  }
  return formattedParams;
}
function formatParamValues(values) {
  if (values.length === 0) {
    return null;
  }
  const serializedValues = values.map((value) => formatValue(value));
  return serializedValues.length === 1 ? serializedValues[0] : `${LIST_START_MARKER}${serializedValues.join(LIST_DELIMITER)}${LIST_END_MARKER}`;
}
function formatValue(value) {
  if (value.flags & I18nParamValueFlags.ElementTag && value.flags & I18nParamValueFlags.TemplateTag) {
    if (typeof value.value !== "object") {
      throw Error("AssertionError: Expected i18n param value to have an element and template slot");
    }
    const elementValue = formatValue({
      ...value,
      value: value.value.element,
      flags: value.flags & ~I18nParamValueFlags.TemplateTag
    });
    const templateValue = formatValue({
      ...value,
      value: value.value.template,
      flags: value.flags & ~I18nParamValueFlags.ElementTag
    });
    if (value.flags & I18nParamValueFlags.OpenTag && value.flags & I18nParamValueFlags.CloseTag) {
      return `${templateValue}${elementValue}${templateValue}`;
    }
    return value.flags & I18nParamValueFlags.CloseTag ? `${elementValue}${templateValue}` : `${templateValue}${elementValue}`;
  }
  if (value.flags & I18nParamValueFlags.OpenTag && value.flags & I18nParamValueFlags.CloseTag) {
    return `${formatValue({
      ...value,
      flags: value.flags & ~I18nParamValueFlags.CloseTag
    })}${formatValue({ ...value, flags: value.flags & ~I18nParamValueFlags.OpenTag })}`;
  }
  if (value.flags === I18nParamValueFlags.None) {
    return `${value.value}`;
  }
  let tagMarker = "";
  let closeMarker = "";
  if (value.flags & I18nParamValueFlags.ElementTag) {
    tagMarker = ELEMENT_MARKER;
  } else if (value.flags & I18nParamValueFlags.TemplateTag) {
    tagMarker = TEMPLATE_MARKER;
  }
  if (tagMarker !== "") {
    closeMarker = value.flags & I18nParamValueFlags.CloseTag ? TAG_CLOSE_MARKER : "";
  }
  const context = value.subTemplateIndex === null ? "" : `${CONTEXT_MARKER}${value.subTemplateIndex}`;
  return `${ESCAPE$1}${closeMarker}${tagMarker}${value.value}${context}${ESCAPE$1}`;
}
function generateAdvance(job) {
  for (const unit of job.units) {
    const slotMap = /* @__PURE__ */ new Map();
    for (const op of unit.create) {
      if (!hasConsumesSlotTrait(op)) {
        continue;
      } else if (op.handle.slot === null) {
        throw new Error(`AssertionError: expected slots to have been allocated before generating advance() calls`);
      }
      slotMap.set(op.xref, op.handle.slot);
    }
    let slotContext = 0;
    for (const op of unit.update) {
      let consumer = null;
      if (hasDependsOnSlotContextTrait(op)) {
        consumer = op;
      } else {
        visitExpressionsInOp(op, (expr) => {
          if (consumer === null && hasDependsOnSlotContextTrait(expr)) {
            consumer = expr;
          }
        });
      }
      if (consumer === null) {
        continue;
      }
      if (!slotMap.has(consumer.target)) {
        throw new Error(`AssertionError: reference to unknown slot for target ${consumer.target}`);
      }
      const slot = slotMap.get(consumer.target);
      if (slotContext !== slot) {
        const delta = slot - slotContext;
        if (delta < 0) {
          throw new Error(`AssertionError: slot counter should never need to move backwards`);
        }
        OpList.insertBefore(createAdvanceOp(delta, consumer.sourceSpan), op);
        slotContext = slot;
      }
    }
  }
}
function generateProjectionDefs(job) {
  const share = job.compatibility === CompatibilityMode.TemplateDefinitionBuilder;
  const selectors = [];
  let projectionSlotIndex = 0;
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.Projection) {
        selectors.push(op.selector);
        op.projectionSlotIndex = projectionSlotIndex++;
      }
    }
  }
  if (selectors.length > 0) {
    let defExpr = null;
    if (selectors.length > 1 || selectors[0] !== "*") {
      const def = selectors.map((s) => s === "*" ? s : parseSelectorToR3Selector(s));
      defExpr = job.pool.getConstLiteral(literalOrArrayLiteral(def), share);
    }
    job.contentSelectors = job.pool.getConstLiteral(literalOrArrayLiteral(selectors), share);
    job.root.create.prepend([createProjectionDefOp(defExpr)]);
  }
}
function generateVariables(job) {
  recursivelyProcessView(
    job.root,
    /* there is no parent scope for the root view */
    null
  );
}
function recursivelyProcessView(view, parentScope) {
  const scope = getScopeForView(view, parentScope);
  for (const op of view.create) {
    switch (op.kind) {
      case OpKind.Template:
        recursivelyProcessView(view.job.views.get(op.xref), scope);
        break;
      case OpKind.Projection:
        if (op.fallbackView !== null) {
          recursivelyProcessView(view.job.views.get(op.fallbackView), scope);
        }
        break;
      case OpKind.RepeaterCreate:
        recursivelyProcessView(view.job.views.get(op.xref), scope);
        if (op.emptyView) {
          recursivelyProcessView(view.job.views.get(op.emptyView), scope);
        }
        break;
      case OpKind.Listener:
      case OpKind.TwoWayListener:
        op.handlerOps.prepend(generateVariablesInScopeForView(view, scope, true));
        break;
    }
  }
  view.update.prepend(generateVariablesInScopeForView(view, scope, false));
}
function getScopeForView(view, parent) {
  const scope = {
    view: view.xref,
    viewContextVariable: {
      kind: SemanticVariableKind.Context,
      name: null,
      view: view.xref
    },
    contextVariables: /* @__PURE__ */ new Map(),
    aliases: view.aliases,
    references: [],
    letDeclarations: [],
    parent
  };
  for (const identifier of view.contextVariables.keys()) {
    scope.contextVariables.set(identifier, {
      kind: SemanticVariableKind.Identifier,
      name: null,
      identifier,
      local: false
    });
  }
  for (const op of view.create) {
    switch (op.kind) {
      case OpKind.ElementStart:
      case OpKind.Template:
        if (!Array.isArray(op.localRefs)) {
          throw new Error(`AssertionError: expected localRefs to be an array`);
        }
        for (let offset = 0; offset < op.localRefs.length; offset++) {
          scope.references.push({
            name: op.localRefs[offset].name,
            targetId: op.xref,
            targetSlot: op.handle,
            offset,
            variable: {
              kind: SemanticVariableKind.Identifier,
              name: null,
              identifier: op.localRefs[offset].name,
              local: false
            }
          });
        }
        break;
      case OpKind.DeclareLet:
        scope.letDeclarations.push({
          targetId: op.xref,
          targetSlot: op.handle,
          variable: {
            kind: SemanticVariableKind.Identifier,
            name: null,
            identifier: op.declaredName,
            local: false
          }
        });
        break;
    }
  }
  return scope;
}
function generateVariablesInScopeForView(view, scope, isListener) {
  const newOps = [];
  if (scope.view !== view.xref) {
    newOps.push(createVariableOp(view.job.allocateXrefId(), scope.viewContextVariable, new NextContextExpr(), VariableFlags.None));
  }
  const scopeView = view.job.views.get(scope.view);
  for (const [name, value] of scopeView.contextVariables) {
    const context = new ContextExpr(scope.view);
    const variable2 = value === CTX_REF ? context : new ReadPropExpr(context, value);
    newOps.push(createVariableOp(view.job.allocateXrefId(), scope.contextVariables.get(name), variable2, VariableFlags.None));
  }
  for (const alias of scopeView.aliases) {
    newOps.push(createVariableOp(view.job.allocateXrefId(), alias, alias.expression.clone(), VariableFlags.AlwaysInline));
  }
  for (const ref of scope.references) {
    newOps.push(createVariableOp(view.job.allocateXrefId(), ref.variable, new ReferenceExpr(ref.targetId, ref.targetSlot, ref.offset), VariableFlags.None));
  }
  if (scope.view !== view.xref || isListener) {
    for (const decl of scope.letDeclarations) {
      newOps.push(createVariableOp(view.job.allocateXrefId(), decl.variable, new ContextLetReferenceExpr(decl.targetId, decl.targetSlot), VariableFlags.None));
    }
  }
  if (scope.parent !== null) {
    newOps.push(...generateVariablesInScopeForView(view, scope.parent, false));
  }
  return newOps;
}
function collectConstExpressions(job) {
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      transformExpressionsInOp(op, (expr) => {
        if (!(expr instanceof ConstCollectedExpr)) {
          return expr;
        }
        return literal(job.addConst(expr.expr));
      }, VisitorContextFlag.None);
    }
  }
}
const STYLE_DOT = "style.";
const CLASS_DOT = "class.";
const STYLE_BANG = "style!";
const CLASS_BANG = "class!";
const BANG_IMPORTANT = "!important";
function parseHostStyleProperties(job) {
  for (const op of job.root.update) {
    if (!(op.kind === OpKind.Binding && op.bindingKind === BindingKind.Property)) {
      continue;
    }
    if (op.name.endsWith(BANG_IMPORTANT)) {
      op.name = op.name.substring(0, op.name.length - BANG_IMPORTANT.length);
    }
    if (op.name.startsWith(STYLE_DOT)) {
      op.bindingKind = BindingKind.StyleProperty;
      op.name = op.name.substring(STYLE_DOT.length);
      if (!isCssCustomProperty(op.name)) {
        op.name = hyphenate$1(op.name);
      }
      const { property: property2, suffix } = parseProperty(op.name);
      op.name = property2;
      op.unit = suffix;
    } else if (op.name.startsWith(STYLE_BANG)) {
      op.bindingKind = BindingKind.StyleProperty;
      op.name = "style";
    } else if (op.name.startsWith(CLASS_DOT)) {
      op.bindingKind = BindingKind.ClassName;
      op.name = parseProperty(op.name.substring(CLASS_DOT.length)).property;
    } else if (op.name.startsWith(CLASS_BANG)) {
      op.bindingKind = BindingKind.ClassName;
      op.name = parseProperty(op.name.substring(CLASS_BANG.length)).property;
    }
  }
}
function isCssCustomProperty(name) {
  return name.startsWith("--");
}
function hyphenate$1(value) {
  return value.replace(/[a-z][A-Z]/g, (v) => {
    return v.charAt(0) + "-" + v.charAt(1);
  }).toLowerCase();
}
function parseProperty(name) {
  const overrideIndex = name.indexOf("!important");
  if (overrideIndex !== -1) {
    name = overrideIndex > 0 ? name.substring(0, overrideIndex) : "";
  }
  let suffix = null;
  let property2 = name;
  const unitIndex = name.lastIndexOf(".");
  if (unitIndex > 0) {
    suffix = name.slice(unitIndex + 1);
    property2 = name.substring(0, unitIndex);
  }
  return { property: property2, suffix };
}
function mapLiteral(obj, quoted = false) {
  return literalMap(Object.keys(obj).map((key) => ({
    key,
    quoted,
    value: obj[key]
  })));
}
class IcuSerializerVisitor {
  visitText(text2) {
    return text2.value;
  }
  visitContainer(container) {
    return container.children.map((child) => child.visit(this)).join("");
  }
  visitIcu(icu) {
    const strCases = Object.keys(icu.cases).map((k) => `${k} {${icu.cases[k].visit(this)}}`);
    const result = `{${icu.expressionPlaceholder}, ${icu.type}, ${strCases.join(" ")}}`;
    return result;
  }
  visitTagPlaceholder(ph) {
    return ph.isVoid ? this.formatPh(ph.startName) : `${this.formatPh(ph.startName)}${ph.children.map((child) => child.visit(this)).join("")}${this.formatPh(ph.closeName)}`;
  }
  visitPlaceholder(ph) {
    return this.formatPh(ph.name);
  }
  visitBlockPlaceholder(ph) {
    return `${this.formatPh(ph.startName)}${ph.children.map((child) => child.visit(this)).join("")}${this.formatPh(ph.closeName)}`;
  }
  visitIcuPlaceholder(ph, context) {
    return this.formatPh(ph.name);
  }
  formatPh(value) {
    return `{${formatI18nPlaceholderName(
      value,
      /* useCamelCase */
      false
    )}}`;
  }
}
const serializer = new IcuSerializerVisitor();
function serializeIcuNode(icu) {
  return icu.visit(serializer);
}
class NodeWithI18n {
  sourceSpan;
  i18n;
  constructor(sourceSpan, i18n2) {
    this.sourceSpan = sourceSpan;
    this.i18n = i18n2;
  }
}
class Text extends NodeWithI18n {
  value;
  tokens;
  constructor(value, sourceSpan, tokens, i18n2) {
    super(sourceSpan, i18n2);
    this.value = value;
    this.tokens = tokens;
  }
  visit(visitor, context) {
    return visitor.visitText(this, context);
  }
}
class Expansion extends NodeWithI18n {
  switchValue;
  type;
  cases;
  switchValueSourceSpan;
  constructor(switchValue, type, cases, sourceSpan, switchValueSourceSpan, i18n2) {
    super(sourceSpan, i18n2);
    this.switchValue = switchValue;
    this.type = type;
    this.cases = cases;
    this.switchValueSourceSpan = switchValueSourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitExpansion(this, context);
  }
}
class ExpansionCase {
  value;
  expression;
  sourceSpan;
  valueSourceSpan;
  expSourceSpan;
  constructor(value, expression, sourceSpan, valueSourceSpan, expSourceSpan) {
    this.value = value;
    this.expression = expression;
    this.sourceSpan = sourceSpan;
    this.valueSourceSpan = valueSourceSpan;
    this.expSourceSpan = expSourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitExpansionCase(this, context);
  }
}
class Attribute extends NodeWithI18n {
  name;
  value;
  keySpan;
  valueSpan;
  valueTokens;
  constructor(name, value, sourceSpan, keySpan, valueSpan, valueTokens, i18n2) {
    super(sourceSpan, i18n2);
    this.name = name;
    this.value = value;
    this.keySpan = keySpan;
    this.valueSpan = valueSpan;
    this.valueTokens = valueTokens;
  }
  visit(visitor, context) {
    return visitor.visitAttribute(this, context);
  }
}
class Element extends NodeWithI18n {
  name;
  attrs;
  children;
  startSourceSpan;
  endSourceSpan;
  constructor(name, attrs, children, sourceSpan, startSourceSpan, endSourceSpan = null, i18n2) {
    super(sourceSpan, i18n2);
    this.name = name;
    this.attrs = attrs;
    this.children = children;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitElement(this, context);
  }
}
class Comment {
  value;
  sourceSpan;
  constructor(value, sourceSpan) {
    this.value = value;
    this.sourceSpan = sourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitComment(this, context);
  }
}
class Block extends NodeWithI18n {
  name;
  parameters;
  children;
  nameSpan;
  startSourceSpan;
  endSourceSpan;
  constructor(name, parameters, children, sourceSpan, nameSpan, startSourceSpan, endSourceSpan = null, i18n2) {
    super(sourceSpan, i18n2);
    this.name = name;
    this.parameters = parameters;
    this.children = children;
    this.nameSpan = nameSpan;
    this.startSourceSpan = startSourceSpan;
    this.endSourceSpan = endSourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitBlock(this, context);
  }
}
class BlockParameter {
  expression;
  sourceSpan;
  constructor(expression, sourceSpan) {
    this.expression = expression;
    this.sourceSpan = sourceSpan;
  }
  visit(visitor, context) {
    return visitor.visitBlockParameter(this, context);
  }
}
class LetDeclaration {
  name;
  value;
  sourceSpan;
  nameSpan;
  valueSpan;
  constructor(name, value, sourceSpan, nameSpan, valueSpan) {
    this.name = name;
    this.value = value;
    this.sourceSpan = sourceSpan;
    this.nameSpan = nameSpan;
    this.valueSpan = valueSpan;
  }
  visit(visitor, context) {
    return visitor.visitLetDeclaration(this, context);
  }
}
function visitAll(visitor, nodes, context = null) {
  const result = [];
  const visit = visitor.visit ? (ast) => visitor.visit(ast, context) || ast.visit(visitor, context) : (ast) => ast.visit(visitor, context);
  nodes.forEach((ast) => {
    const astResult = visit(ast);
    if (astResult) {
      result.push(astResult);
    }
  });
  return result;
}
class RecursiveVisitor {
  constructor() {
  }
  visitElement(ast, context) {
    this.visitChildren(context, (visit) => {
      visit(ast.attrs);
      visit(ast.children);
    });
  }
  visitAttribute(ast, context) {
  }
  visitText(ast, context) {
  }
  visitComment(ast, context) {
  }
  visitExpansion(ast, context) {
    return this.visitChildren(context, (visit) => {
      visit(ast.cases);
    });
  }
  visitExpansionCase(ast, context) {
  }
  visitBlock(block, context) {
    this.visitChildren(context, (visit) => {
      visit(block.parameters);
      visit(block.children);
    });
  }
  visitBlockParameter(ast, context) {
  }
  visitLetDeclaration(decl, context) {
  }
  visitChildren(context, cb) {
    let results = [];
    let t = this;
    function visit(children) {
      if (children)
        results.push(visitAll(t, children, context));
    }
    cb(visit);
    return Array.prototype.concat.apply([], results);
  }
}
const NAMED_ENTITIES = {
  "AElig": "Æ",
  "AMP": "&",
  "amp": "&",
  "Aacute": "Á",
  "Abreve": "Ă",
  "Acirc": "Â",
  "Acy": "А",
  "Afr": "𝔄",
  "Agrave": "À",
  "Alpha": "Α",
  "Amacr": "Ā",
  "And": "⩓",
  "Aogon": "Ą",
  "Aopf": "𝔸",
  "ApplyFunction": "⁡",
  "af": "⁡",
  "Aring": "Å",
  "angst": "Å",
  "Ascr": "𝒜",
  "Assign": "≔",
  "colone": "≔",
  "coloneq": "≔",
  "Atilde": "Ã",
  "Auml": "Ä",
  "Backslash": "∖",
  "setminus": "∖",
  "setmn": "∖",
  "smallsetminus": "∖",
  "ssetmn": "∖",
  "Barv": "⫧",
  "Barwed": "⌆",
  "doublebarwedge": "⌆",
  "Bcy": "Б",
  "Because": "∵",
  "becaus": "∵",
  "because": "∵",
  "Bernoullis": "ℬ",
  "Bscr": "ℬ",
  "bernou": "ℬ",
  "Beta": "Β",
  "Bfr": "𝔅",
  "Bopf": "𝔹",
  "Breve": "˘",
  "breve": "˘",
  "Bumpeq": "≎",
  "HumpDownHump": "≎",
  "bump": "≎",
  "CHcy": "Ч",
  "COPY": "©",
  "copy": "©",
  "Cacute": "Ć",
  "Cap": "⋒",
  "CapitalDifferentialD": "ⅅ",
  "DD": "ⅅ",
  "Cayleys": "ℭ",
  "Cfr": "ℭ",
  "Ccaron": "Č",
  "Ccedil": "Ç",
  "Ccirc": "Ĉ",
  "Cconint": "∰",
  "Cdot": "Ċ",
  "Cedilla": "¸",
  "cedil": "¸",
  "CenterDot": "·",
  "centerdot": "·",
  "middot": "·",
  "Chi": "Χ",
  "CircleDot": "⊙",
  "odot": "⊙",
  "CircleMinus": "⊖",
  "ominus": "⊖",
  "CirclePlus": "⊕",
  "oplus": "⊕",
  "CircleTimes": "⊗",
  "otimes": "⊗",
  "ClockwiseContourIntegral": "∲",
  "cwconint": "∲",
  "CloseCurlyDoubleQuote": "”",
  "rdquo": "”",
  "rdquor": "”",
  "CloseCurlyQuote": "’",
  "rsquo": "’",
  "rsquor": "’",
  "Colon": "∷",
  "Proportion": "∷",
  "Colone": "⩴",
  "Congruent": "≡",
  "equiv": "≡",
  "Conint": "∯",
  "DoubleContourIntegral": "∯",
  "ContourIntegral": "∮",
  "conint": "∮",
  "oint": "∮",
  "Copf": "ℂ",
  "complexes": "ℂ",
  "Coproduct": "∐",
  "coprod": "∐",
  "CounterClockwiseContourIntegral": "∳",
  "awconint": "∳",
  "Cross": "⨯",
  "Cscr": "𝒞",
  "Cup": "⋓",
  "CupCap": "≍",
  "asympeq": "≍",
  "DDotrahd": "⤑",
  "DJcy": "Ђ",
  "DScy": "Ѕ",
  "DZcy": "Џ",
  "Dagger": "‡",
  "ddagger": "‡",
  "Darr": "↡",
  "Dashv": "⫤",
  "DoubleLeftTee": "⫤",
  "Dcaron": "Ď",
  "Dcy": "Д",
  "Del": "∇",
  "nabla": "∇",
  "Delta": "Δ",
  "Dfr": "𝔇",
  "DiacriticalAcute": "´",
  "acute": "´",
  "DiacriticalDot": "˙",
  "dot": "˙",
  "DiacriticalDoubleAcute": "˝",
  "dblac": "˝",
  "DiacriticalGrave": "`",
  "grave": "`",
  "DiacriticalTilde": "˜",
  "tilde": "˜",
  "Diamond": "⋄",
  "diam": "⋄",
  "diamond": "⋄",
  "DifferentialD": "ⅆ",
  "dd": "ⅆ",
  "Dopf": "𝔻",
  "Dot": "¨",
  "DoubleDot": "¨",
  "die": "¨",
  "uml": "¨",
  "DotDot": "⃜",
  "DotEqual": "≐",
  "doteq": "≐",
  "esdot": "≐",
  "DoubleDownArrow": "⇓",
  "Downarrow": "⇓",
  "dArr": "⇓",
  "DoubleLeftArrow": "⇐",
  "Leftarrow": "⇐",
  "lArr": "⇐",
  "DoubleLeftRightArrow": "⇔",
  "Leftrightarrow": "⇔",
  "hArr": "⇔",
  "iff": "⇔",
  "DoubleLongLeftArrow": "⟸",
  "Longleftarrow": "⟸",
  "xlArr": "⟸",
  "DoubleLongLeftRightArrow": "⟺",
  "Longleftrightarrow": "⟺",
  "xhArr": "⟺",
  "DoubleLongRightArrow": "⟹",
  "Longrightarrow": "⟹",
  "xrArr": "⟹",
  "DoubleRightArrow": "⇒",
  "Implies": "⇒",
  "Rightarrow": "⇒",
  "rArr": "⇒",
  "DoubleRightTee": "⊨",
  "vDash": "⊨",
  "DoubleUpArrow": "⇑",
  "Uparrow": "⇑",
  "uArr": "⇑",
  "DoubleUpDownArrow": "⇕",
  "Updownarrow": "⇕",
  "vArr": "⇕",
  "DoubleVerticalBar": "∥",
  "par": "∥",
  "parallel": "∥",
  "shortparallel": "∥",
  "spar": "∥",
  "DownArrow": "↓",
  "ShortDownArrow": "↓",
  "darr": "↓",
  "downarrow": "↓",
  "DownArrowBar": "⤓",
  "DownArrowUpArrow": "⇵",
  "duarr": "⇵",
  "DownBreve": "̑",
  "DownLeftRightVector": "⥐",
  "DownLeftTeeVector": "⥞",
  "DownLeftVector": "↽",
  "leftharpoondown": "↽",
  "lhard": "↽",
  "DownLeftVectorBar": "⥖",
  "DownRightTeeVector": "⥟",
  "DownRightVector": "⇁",
  "rhard": "⇁",
  "rightharpoondown": "⇁",
  "DownRightVectorBar": "⥗",
  "DownTee": "⊤",
  "top": "⊤",
  "DownTeeArrow": "↧",
  "mapstodown": "↧",
  "Dscr": "𝒟",
  "Dstrok": "Đ",
  "ENG": "Ŋ",
  "ETH": "Ð",
  "Eacute": "É",
  "Ecaron": "Ě",
  "Ecirc": "Ê",
  "Ecy": "Э",
  "Edot": "Ė",
  "Efr": "𝔈",
  "Egrave": "È",
  "Element": "∈",
  "in": "∈",
  "isin": "∈",
  "isinv": "∈",
  "Emacr": "Ē",
  "EmptySmallSquare": "◻",
  "EmptyVerySmallSquare": "▫",
  "Eogon": "Ę",
  "Eopf": "𝔼",
  "Epsilon": "Ε",
  "Equal": "⩵",
  "EqualTilde": "≂",
  "eqsim": "≂",
  "esim": "≂",
  "Equilibrium": "⇌",
  "rightleftharpoons": "⇌",
  "rlhar": "⇌",
  "Escr": "ℰ",
  "expectation": "ℰ",
  "Esim": "⩳",
  "Eta": "Η",
  "Euml": "Ë",
  "Exists": "∃",
  "exist": "∃",
  "ExponentialE": "ⅇ",
  "ee": "ⅇ",
  "exponentiale": "ⅇ",
  "Fcy": "Ф",
  "Ffr": "𝔉",
  "FilledSmallSquare": "◼",
  "FilledVerySmallSquare": "▪",
  "blacksquare": "▪",
  "squarf": "▪",
  "squf": "▪",
  "Fopf": "𝔽",
  "ForAll": "∀",
  "forall": "∀",
  "Fouriertrf": "ℱ",
  "Fscr": "ℱ",
  "GJcy": "Ѓ",
  "GT": ">",
  "gt": ">",
  "Gamma": "Γ",
  "Gammad": "Ϝ",
  "Gbreve": "Ğ",
  "Gcedil": "Ģ",
  "Gcirc": "Ĝ",
  "Gcy": "Г",
  "Gdot": "Ġ",
  "Gfr": "𝔊",
  "Gg": "⋙",
  "ggg": "⋙",
  "Gopf": "𝔾",
  "GreaterEqual": "≥",
  "ge": "≥",
  "geq": "≥",
  "GreaterEqualLess": "⋛",
  "gel": "⋛",
  "gtreqless": "⋛",
  "GreaterFullEqual": "≧",
  "gE": "≧",
  "geqq": "≧",
  "GreaterGreater": "⪢",
  "GreaterLess": "≷",
  "gl": "≷",
  "gtrless": "≷",
  "GreaterSlantEqual": "⩾",
  "geqslant": "⩾",
  "ges": "⩾",
  "GreaterTilde": "≳",
  "gsim": "≳",
  "gtrsim": "≳",
  "Gscr": "𝒢",
  "Gt": "≫",
  "NestedGreaterGreater": "≫",
  "gg": "≫",
  "HARDcy": "Ъ",
  "Hacek": "ˇ",
  "caron": "ˇ",
  "Hat": "^",
  "Hcirc": "Ĥ",
  "Hfr": "ℌ",
  "Poincareplane": "ℌ",
  "HilbertSpace": "ℋ",
  "Hscr": "ℋ",
  "hamilt": "ℋ",
  "Hopf": "ℍ",
  "quaternions": "ℍ",
  "HorizontalLine": "─",
  "boxh": "─",
  "Hstrok": "Ħ",
  "HumpEqual": "≏",
  "bumpe": "≏",
  "bumpeq": "≏",
  "IEcy": "Е",
  "IJlig": "Ĳ",
  "IOcy": "Ё",
  "Iacute": "Í",
  "Icirc": "Î",
  "Icy": "И",
  "Idot": "İ",
  "Ifr": "ℑ",
  "Im": "ℑ",
  "image": "ℑ",
  "imagpart": "ℑ",
  "Igrave": "Ì",
  "Imacr": "Ī",
  "ImaginaryI": "ⅈ",
  "ii": "ⅈ",
  "Int": "∬",
  "Integral": "∫",
  "int": "∫",
  "Intersection": "⋂",
  "bigcap": "⋂",
  "xcap": "⋂",
  "InvisibleComma": "⁣",
  "ic": "⁣",
  "InvisibleTimes": "⁢",
  "it": "⁢",
  "Iogon": "Į",
  "Iopf": "𝕀",
  "Iota": "Ι",
  "Iscr": "ℐ",
  "imagline": "ℐ",
  "Itilde": "Ĩ",
  "Iukcy": "І",
  "Iuml": "Ï",
  "Jcirc": "Ĵ",
  "Jcy": "Й",
  "Jfr": "𝔍",
  "Jopf": "𝕁",
  "Jscr": "𝒥",
  "Jsercy": "Ј",
  "Jukcy": "Є",
  "KHcy": "Х",
  "KJcy": "Ќ",
  "Kappa": "Κ",
  "Kcedil": "Ķ",
  "Kcy": "К",
  "Kfr": "𝔎",
  "Kopf": "𝕂",
  "Kscr": "𝒦",
  "LJcy": "Љ",
  "LT": "<",
  "lt": "<",
  "Lacute": "Ĺ",
  "Lambda": "Λ",
  "Lang": "⟪",
  "Laplacetrf": "ℒ",
  "Lscr": "ℒ",
  "lagran": "ℒ",
  "Larr": "↞",
  "twoheadleftarrow": "↞",
  "Lcaron": "Ľ",
  "Lcedil": "Ļ",
  "Lcy": "Л",
  "LeftAngleBracket": "⟨",
  "lang": "⟨",
  "langle": "⟨",
  "LeftArrow": "←",
  "ShortLeftArrow": "←",
  "larr": "←",
  "leftarrow": "←",
  "slarr": "←",
  "LeftArrowBar": "⇤",
  "larrb": "⇤",
  "LeftArrowRightArrow": "⇆",
  "leftrightarrows": "⇆",
  "lrarr": "⇆",
  "LeftCeiling": "⌈",
  "lceil": "⌈",
  "LeftDoubleBracket": "⟦",
  "lobrk": "⟦",
  "LeftDownTeeVector": "⥡",
  "LeftDownVector": "⇃",
  "dharl": "⇃",
  "downharpoonleft": "⇃",
  "LeftDownVectorBar": "⥙",
  "LeftFloor": "⌊",
  "lfloor": "⌊",
  "LeftRightArrow": "↔",
  "harr": "↔",
  "leftrightarrow": "↔",
  "LeftRightVector": "⥎",
  "LeftTee": "⊣",
  "dashv": "⊣",
  "LeftTeeArrow": "↤",
  "mapstoleft": "↤",
  "LeftTeeVector": "⥚",
  "LeftTriangle": "⊲",
  "vartriangleleft": "⊲",
  "vltri": "⊲",
  "LeftTriangleBar": "⧏",
  "LeftTriangleEqual": "⊴",
  "ltrie": "⊴",
  "trianglelefteq": "⊴",
  "LeftUpDownVector": "⥑",
  "LeftUpTeeVector": "⥠",
  "LeftUpVector": "↿",
  "uharl": "↿",
  "upharpoonleft": "↿",
  "LeftUpVectorBar": "⥘",
  "LeftVector": "↼",
  "leftharpoonup": "↼",
  "lharu": "↼",
  "LeftVectorBar": "⥒",
  "LessEqualGreater": "⋚",
  "leg": "⋚",
  "lesseqgtr": "⋚",
  "LessFullEqual": "≦",
  "lE": "≦",
  "leqq": "≦",
  "LessGreater": "≶",
  "lessgtr": "≶",
  "lg": "≶",
  "LessLess": "⪡",
  "LessSlantEqual": "⩽",
  "leqslant": "⩽",
  "les": "⩽",
  "LessTilde": "≲",
  "lesssim": "≲",
  "lsim": "≲",
  "Lfr": "𝔏",
  "Ll": "⋘",
  "Lleftarrow": "⇚",
  "lAarr": "⇚",
  "Lmidot": "Ŀ",
  "LongLeftArrow": "⟵",
  "longleftarrow": "⟵",
  "xlarr": "⟵",
  "LongLeftRightArrow": "⟷",
  "longleftrightarrow": "⟷",
  "xharr": "⟷",
  "LongRightArrow": "⟶",
  "longrightarrow": "⟶",
  "xrarr": "⟶",
  "Lopf": "𝕃",
  "LowerLeftArrow": "↙",
  "swarr": "↙",
  "swarrow": "↙",
  "LowerRightArrow": "↘",
  "searr": "↘",
  "searrow": "↘",
  "Lsh": "↰",
  "lsh": "↰",
  "Lstrok": "Ł",
  "Lt": "≪",
  "NestedLessLess": "≪",
  "ll": "≪",
  "Map": "⤅",
  "Mcy": "М",
  "MediumSpace": " ",
  "Mellintrf": "ℳ",
  "Mscr": "ℳ",
  "phmmat": "ℳ",
  "Mfr": "𝔐",
  "MinusPlus": "∓",
  "mnplus": "∓",
  "mp": "∓",
  "Mopf": "𝕄",
  "Mu": "Μ",
  "NJcy": "Њ",
  "Nacute": "Ń",
  "Ncaron": "Ň",
  "Ncedil": "Ņ",
  "Ncy": "Н",
  "NegativeMediumSpace": "​",
  "NegativeThickSpace": "​",
  "NegativeThinSpace": "​",
  "NegativeVeryThinSpace": "​",
  "ZeroWidthSpace": "​",
  "NewLine": "\n",
  "Nfr": "𝔑",
  "NoBreak": "⁠",
  "NonBreakingSpace": " ",
  "nbsp": " ",
  "Nopf": "ℕ",
  "naturals": "ℕ",
  "Not": "⫬",
  "NotCongruent": "≢",
  "nequiv": "≢",
  "NotCupCap": "≭",
  "NotDoubleVerticalBar": "∦",
  "npar": "∦",
  "nparallel": "∦",
  "nshortparallel": "∦",
  "nspar": "∦",
  "NotElement": "∉",
  "notin": "∉",
  "notinva": "∉",
  "NotEqual": "≠",
  "ne": "≠",
  "NotEqualTilde": "≂̸",
  "nesim": "≂̸",
  "NotExists": "∄",
  "nexist": "∄",
  "nexists": "∄",
  "NotGreater": "≯",
  "ngt": "≯",
  "ngtr": "≯",
  "NotGreaterEqual": "≱",
  "nge": "≱",
  "ngeq": "≱",
  "NotGreaterFullEqual": "≧̸",
  "ngE": "≧̸",
  "ngeqq": "≧̸",
  "NotGreaterGreater": "≫̸",
  "nGtv": "≫̸",
  "NotGreaterLess": "≹",
  "ntgl": "≹",
  "NotGreaterSlantEqual": "⩾̸",
  "ngeqslant": "⩾̸",
  "nges": "⩾̸",
  "NotGreaterTilde": "≵",
  "ngsim": "≵",
  "NotHumpDownHump": "≎̸",
  "nbump": "≎̸",
  "NotHumpEqual": "≏̸",
  "nbumpe": "≏̸",
  "NotLeftTriangle": "⋪",
  "nltri": "⋪",
  "ntriangleleft": "⋪",
  "NotLeftTriangleBar": "⧏̸",
  "NotLeftTriangleEqual": "⋬",
  "nltrie": "⋬",
  "ntrianglelefteq": "⋬",
  "NotLess": "≮",
  "nless": "≮",
  "nlt": "≮",
  "NotLessEqual": "≰",
  "nle": "≰",
  "nleq": "≰",
  "NotLessGreater": "≸",
  "ntlg": "≸",
  "NotLessLess": "≪̸",
  "nLtv": "≪̸",
  "NotLessSlantEqual": "⩽̸",
  "nleqslant": "⩽̸",
  "nles": "⩽̸",
  "NotLessTilde": "≴",
  "nlsim": "≴",
  "NotNestedGreaterGreater": "⪢̸",
  "NotNestedLessLess": "⪡̸",
  "NotPrecedes": "⊀",
  "npr": "⊀",
  "nprec": "⊀",
  "NotPrecedesEqual": "⪯̸",
  "npre": "⪯̸",
  "npreceq": "⪯̸",
  "NotPrecedesSlantEqual": "⋠",
  "nprcue": "⋠",
  "NotReverseElement": "∌",
  "notni": "∌",
  "notniva": "∌",
  "NotRightTriangle": "⋫",
  "nrtri": "⋫",
  "ntriangleright": "⋫",
  "NotRightTriangleBar": "⧐̸",
  "NotRightTriangleEqual": "⋭",
  "nrtrie": "⋭",
  "ntrianglerighteq": "⋭",
  "NotSquareSubset": "⊏̸",
  "NotSquareSubsetEqual": "⋢",
  "nsqsube": "⋢",
  "NotSquareSuperset": "⊐̸",
  "NotSquareSupersetEqual": "⋣",
  "nsqsupe": "⋣",
  "NotSubset": "⊂⃒",
  "nsubset": "⊂⃒",
  "vnsub": "⊂⃒",
  "NotSubsetEqual": "⊈",
  "nsube": "⊈",
  "nsubseteq": "⊈",
  "NotSucceeds": "⊁",
  "nsc": "⊁",
  "nsucc": "⊁",
  "NotSucceedsEqual": "⪰̸",
  "nsce": "⪰̸",
  "nsucceq": "⪰̸",
  "NotSucceedsSlantEqual": "⋡",
  "nsccue": "⋡",
  "NotSucceedsTilde": "≿̸",
  "NotSuperset": "⊃⃒",
  "nsupset": "⊃⃒",
  "vnsup": "⊃⃒",
  "NotSupersetEqual": "⊉",
  "nsupe": "⊉",
  "nsupseteq": "⊉",
  "NotTilde": "≁",
  "nsim": "≁",
  "NotTildeEqual": "≄",
  "nsime": "≄",
  "nsimeq": "≄",
  "NotTildeFullEqual": "≇",
  "ncong": "≇",
  "NotTildeTilde": "≉",
  "nap": "≉",
  "napprox": "≉",
  "NotVerticalBar": "∤",
  "nmid": "∤",
  "nshortmid": "∤",
  "nsmid": "∤",
  "Nscr": "𝒩",
  "Ntilde": "Ñ",
  "Nu": "Ν",
  "OElig": "Œ",
  "Oacute": "Ó",
  "Ocirc": "Ô",
  "Ocy": "О",
  "Odblac": "Ő",
  "Ofr": "𝔒",
  "Ograve": "Ò",
  "Omacr": "Ō",
  "Omega": "Ω",
  "ohm": "Ω",
  "Omicron": "Ο",
  "Oopf": "𝕆",
  "OpenCurlyDoubleQuote": "“",
  "ldquo": "“",
  "OpenCurlyQuote": "‘",
  "lsquo": "‘",
  "Or": "⩔",
  "Oscr": "𝒪",
  "Oslash": "Ø",
  "Otilde": "Õ",
  "Otimes": "⨷",
  "Ouml": "Ö",
  "OverBar": "‾",
  "oline": "‾",
  "OverBrace": "⏞",
  "OverBracket": "⎴",
  "tbrk": "⎴",
  "OverParenthesis": "⏜",
  "PartialD": "∂",
  "part": "∂",
  "Pcy": "П",
  "Pfr": "𝔓",
  "Phi": "Φ",
  "Pi": "Π",
  "PlusMinus": "±",
  "plusmn": "±",
  "pm": "±",
  "Popf": "ℙ",
  "primes": "ℙ",
  "Pr": "⪻",
  "Precedes": "≺",
  "pr": "≺",
  "prec": "≺",
  "PrecedesEqual": "⪯",
  "pre": "⪯",
  "preceq": "⪯",
  "PrecedesSlantEqual": "≼",
  "prcue": "≼",
  "preccurlyeq": "≼",
  "PrecedesTilde": "≾",
  "precsim": "≾",
  "prsim": "≾",
  "Prime": "″",
  "Product": "∏",
  "prod": "∏",
  "Proportional": "∝",
  "prop": "∝",
  "propto": "∝",
  "varpropto": "∝",
  "vprop": "∝",
  "Pscr": "𝒫",
  "Psi": "Ψ",
  "QUOT": '"',
  "quot": '"',
  "Qfr": "𝔔",
  "Qopf": "ℚ",
  "rationals": "ℚ",
  "Qscr": "𝒬",
  "RBarr": "⤐",
  "drbkarow": "⤐",
  "REG": "®",
  "circledR": "®",
  "reg": "®",
  "Racute": "Ŕ",
  "Rang": "⟫",
  "Rarr": "↠",
  "twoheadrightarrow": "↠",
  "Rarrtl": "⤖",
  "Rcaron": "Ř",
  "Rcedil": "Ŗ",
  "Rcy": "Р",
  "Re": "ℜ",
  "Rfr": "ℜ",
  "real": "ℜ",
  "realpart": "ℜ",
  "ReverseElement": "∋",
  "SuchThat": "∋",
  "ni": "∋",
  "niv": "∋",
  "ReverseEquilibrium": "⇋",
  "leftrightharpoons": "⇋",
  "lrhar": "⇋",
  "ReverseUpEquilibrium": "⥯",
  "duhar": "⥯",
  "Rho": "Ρ",
  "RightAngleBracket": "⟩",
  "rang": "⟩",
  "rangle": "⟩",
  "RightArrow": "→",
  "ShortRightArrow": "→",
  "rarr": "→",
  "rightarrow": "→",
  "srarr": "→",
  "RightArrowBar": "⇥",
  "rarrb": "⇥",
  "RightArrowLeftArrow": "⇄",
  "rightleftarrows": "⇄",
  "rlarr": "⇄",
  "RightCeiling": "⌉",
  "rceil": "⌉",
  "RightDoubleBracket": "⟧",
  "robrk": "⟧",
  "RightDownTeeVector": "⥝",
  "RightDownVector": "⇂",
  "dharr": "⇂",
  "downharpoonright": "⇂",
  "RightDownVectorBar": "⥕",
  "RightFloor": "⌋",
  "rfloor": "⌋",
  "RightTee": "⊢",
  "vdash": "⊢",
  "RightTeeArrow": "↦",
  "map": "↦",
  "mapsto": "↦",
  "RightTeeVector": "⥛",
  "RightTriangle": "⊳",
  "vartriangleright": "⊳",
  "vrtri": "⊳",
  "RightTriangleBar": "⧐",
  "RightTriangleEqual": "⊵",
  "rtrie": "⊵",
  "trianglerighteq": "⊵",
  "RightUpDownVector": "⥏",
  "RightUpTeeVector": "⥜",
  "RightUpVector": "↾",
  "uharr": "↾",
  "upharpoonright": "↾",
  "RightUpVectorBar": "⥔",
  "RightVector": "⇀",
  "rharu": "⇀",
  "rightharpoonup": "⇀",
  "RightVectorBar": "⥓",
  "Ropf": "ℝ",
  "reals": "ℝ",
  "RoundImplies": "⥰",
  "Rrightarrow": "⇛",
  "rAarr": "⇛",
  "Rscr": "ℛ",
  "realine": "ℛ",
  "Rsh": "↱",
  "rsh": "↱",
  "RuleDelayed": "⧴",
  "SHCHcy": "Щ",
  "SHcy": "Ш",
  "SOFTcy": "Ь",
  "Sacute": "Ś",
  "Sc": "⪼",
  "Scaron": "Š",
  "Scedil": "Ş",
  "Scirc": "Ŝ",
  "Scy": "С",
  "Sfr": "𝔖",
  "ShortUpArrow": "↑",
  "UpArrow": "↑",
  "uarr": "↑",
  "uparrow": "↑",
  "Sigma": "Σ",
  "SmallCircle": "∘",
  "compfn": "∘",
  "Sopf": "𝕊",
  "Sqrt": "√",
  "radic": "√",
  "Square": "□",
  "squ": "□",
  "square": "□",
  "SquareIntersection": "⊓",
  "sqcap": "⊓",
  "SquareSubset": "⊏",
  "sqsub": "⊏",
  "sqsubset": "⊏",
  "SquareSubsetEqual": "⊑",
  "sqsube": "⊑",
  "sqsubseteq": "⊑",
  "SquareSuperset": "⊐",
  "sqsup": "⊐",
  "sqsupset": "⊐",
  "SquareSupersetEqual": "⊒",
  "sqsupe": "⊒",
  "sqsupseteq": "⊒",
  "SquareUnion": "⊔",
  "sqcup": "⊔",
  "Sscr": "𝒮",
  "Star": "⋆",
  "sstarf": "⋆",
  "Sub": "⋐",
  "Subset": "⋐",
  "SubsetEqual": "⊆",
  "sube": "⊆",
  "subseteq": "⊆",
  "Succeeds": "≻",
  "sc": "≻",
  "succ": "≻",
  "SucceedsEqual": "⪰",
  "sce": "⪰",
  "succeq": "⪰",
  "SucceedsSlantEqual": "≽",
  "sccue": "≽",
  "succcurlyeq": "≽",
  "SucceedsTilde": "≿",
  "scsim": "≿",
  "succsim": "≿",
  "Sum": "∑",
  "sum": "∑",
  "Sup": "⋑",
  "Supset": "⋑",
  "Superset": "⊃",
  "sup": "⊃",
  "supset": "⊃",
  "SupersetEqual": "⊇",
  "supe": "⊇",
  "supseteq": "⊇",
  "THORN": "Þ",
  "TRADE": "™",
  "trade": "™",
  "TSHcy": "Ћ",
  "TScy": "Ц",
  "Tab": "	",
  "Tau": "Τ",
  "Tcaron": "Ť",
  "Tcedil": "Ţ",
  "Tcy": "Т",
  "Tfr": "𝔗",
  "Therefore": "∴",
  "there4": "∴",
  "therefore": "∴",
  "Theta": "Θ",
  "ThickSpace": "  ",
  "ThinSpace": " ",
  "thinsp": " ",
  "Tilde": "∼",
  "sim": "∼",
  "thicksim": "∼",
  "thksim": "∼",
  "TildeEqual": "≃",
  "sime": "≃",
  "simeq": "≃",
  "TildeFullEqual": "≅",
  "cong": "≅",
  "TildeTilde": "≈",
  "ap": "≈",
  "approx": "≈",
  "asymp": "≈",
  "thickapprox": "≈",
  "thkap": "≈",
  "Topf": "𝕋",
  "TripleDot": "⃛",
  "tdot": "⃛",
  "Tscr": "𝒯",
  "Tstrok": "Ŧ",
  "Uacute": "Ú",
  "Uarr": "↟",
  "Uarrocir": "⥉",
  "Ubrcy": "Ў",
  "Ubreve": "Ŭ",
  "Ucirc": "Û",
  "Ucy": "У",
  "Udblac": "Ű",
  "Ufr": "𝔘",
  "Ugrave": "Ù",
  "Umacr": "Ū",
  "UnderBar": "_",
  "lowbar": "_",
  "UnderBrace": "⏟",
  "UnderBracket": "⎵",
  "bbrk": "⎵",
  "UnderParenthesis": "⏝",
  "Union": "⋃",
  "bigcup": "⋃",
  "xcup": "⋃",
  "UnionPlus": "⊎",
  "uplus": "⊎",
  "Uogon": "Ų",
  "Uopf": "𝕌",
  "UpArrowBar": "⤒",
  "UpArrowDownArrow": "⇅",
  "udarr": "⇅",
  "UpDownArrow": "↕",
  "updownarrow": "↕",
  "varr": "↕",
  "UpEquilibrium": "⥮",
  "udhar": "⥮",
  "UpTee": "⊥",
  "bot": "⊥",
  "bottom": "⊥",
  "perp": "⊥",
  "UpTeeArrow": "↥",
  "mapstoup": "↥",
  "UpperLeftArrow": "↖",
  "nwarr": "↖",
  "nwarrow": "↖",
  "UpperRightArrow": "↗",
  "nearr": "↗",
  "nearrow": "↗",
  "Upsi": "ϒ",
  "upsih": "ϒ",
  "Upsilon": "Υ",
  "Uring": "Ů",
  "Uscr": "𝒰",
  "Utilde": "Ũ",
  "Uuml": "Ü",
  "VDash": "⊫",
  "Vbar": "⫫",
  "Vcy": "В",
  "Vdash": "⊩",
  "Vdashl": "⫦",
  "Vee": "⋁",
  "bigvee": "⋁",
  "xvee": "⋁",
  "Verbar": "‖",
  "Vert": "‖",
  "VerticalBar": "∣",
  "mid": "∣",
  "shortmid": "∣",
  "smid": "∣",
  "VerticalLine": "|",
  "verbar": "|",
  "vert": "|",
  "VerticalSeparator": "❘",
  "VerticalTilde": "≀",
  "wr": "≀",
  "wreath": "≀",
  "VeryThinSpace": " ",
  "hairsp": " ",
  "Vfr": "𝔙",
  "Vopf": "𝕍",
  "Vscr": "𝒱",
  "Vvdash": "⊪",
  "Wcirc": "Ŵ",
  "Wedge": "⋀",
  "bigwedge": "⋀",
  "xwedge": "⋀",
  "Wfr": "𝔚",
  "Wopf": "𝕎",
  "Wscr": "𝒲",
  "Xfr": "𝔛",
  "Xi": "Ξ",
  "Xopf": "𝕏",
  "Xscr": "𝒳",
  "YAcy": "Я",
  "YIcy": "Ї",
  "YUcy": "Ю",
  "Yacute": "Ý",
  "Ycirc": "Ŷ",
  "Ycy": "Ы",
  "Yfr": "𝔜",
  "Yopf": "𝕐",
  "Yscr": "𝒴",
  "Yuml": "Ÿ",
  "ZHcy": "Ж",
  "Zacute": "Ź",
  "Zcaron": "Ž",
  "Zcy": "З",
  "Zdot": "Ż",
  "Zeta": "Ζ",
  "Zfr": "ℨ",
  "zeetrf": "ℨ",
  "Zopf": "ℤ",
  "integers": "ℤ",
  "Zscr": "𝒵",
  "aacute": "á",
  "abreve": "ă",
  "ac": "∾",
  "mstpos": "∾",
  "acE": "∾̳",
  "acd": "∿",
  "acirc": "â",
  "acy": "а",
  "aelig": "æ",
  "afr": "𝔞",
  "agrave": "à",
  "alefsym": "ℵ",
  "aleph": "ℵ",
  "alpha": "α",
  "amacr": "ā",
  "amalg": "⨿",
  "and": "∧",
  "wedge": "∧",
  "andand": "⩕",
  "andd": "⩜",
  "andslope": "⩘",
  "andv": "⩚",
  "ang": "∠",
  "angle": "∠",
  "ange": "⦤",
  "angmsd": "∡",
  "measuredangle": "∡",
  "angmsdaa": "⦨",
  "angmsdab": "⦩",
  "angmsdac": "⦪",
  "angmsdad": "⦫",
  "angmsdae": "⦬",
  "angmsdaf": "⦭",
  "angmsdag": "⦮",
  "angmsdah": "⦯",
  "angrt": "∟",
  "angrtvb": "⊾",
  "angrtvbd": "⦝",
  "angsph": "∢",
  "angzarr": "⍼",
  "aogon": "ą",
  "aopf": "𝕒",
  "apE": "⩰",
  "apacir": "⩯",
  "ape": "≊",
  "approxeq": "≊",
  "apid": "≋",
  "apos": "'",
  "aring": "å",
  "ascr": "𝒶",
  "ast": "*",
  "midast": "*",
  "atilde": "ã",
  "auml": "ä",
  "awint": "⨑",
  "bNot": "⫭",
  "backcong": "≌",
  "bcong": "≌",
  "backepsilon": "϶",
  "bepsi": "϶",
  "backprime": "‵",
  "bprime": "‵",
  "backsim": "∽",
  "bsim": "∽",
  "backsimeq": "⋍",
  "bsime": "⋍",
  "barvee": "⊽",
  "barwed": "⌅",
  "barwedge": "⌅",
  "bbrktbrk": "⎶",
  "bcy": "б",
  "bdquo": "„",
  "ldquor": "„",
  "bemptyv": "⦰",
  "beta": "β",
  "beth": "ℶ",
  "between": "≬",
  "twixt": "≬",
  "bfr": "𝔟",
  "bigcirc": "◯",
  "xcirc": "◯",
  "bigodot": "⨀",
  "xodot": "⨀",
  "bigoplus": "⨁",
  "xoplus": "⨁",
  "bigotimes": "⨂",
  "xotime": "⨂",
  "bigsqcup": "⨆",
  "xsqcup": "⨆",
  "bigstar": "★",
  "starf": "★",
  "bigtriangledown": "▽",
  "xdtri": "▽",
  "bigtriangleup": "△",
  "xutri": "△",
  "biguplus": "⨄",
  "xuplus": "⨄",
  "bkarow": "⤍",
  "rbarr": "⤍",
  "blacklozenge": "⧫",
  "lozf": "⧫",
  "blacktriangle": "▴",
  "utrif": "▴",
  "blacktriangledown": "▾",
  "dtrif": "▾",
  "blacktriangleleft": "◂",
  "ltrif": "◂",
  "blacktriangleright": "▸",
  "rtrif": "▸",
  "blank": "␣",
  "blk12": "▒",
  "blk14": "░",
  "blk34": "▓",
  "block": "█",
  "bne": "=⃥",
  "bnequiv": "≡⃥",
  "bnot": "⌐",
  "bopf": "𝕓",
  "bowtie": "⋈",
  "boxDL": "╗",
  "boxDR": "╔",
  "boxDl": "╖",
  "boxDr": "╓",
  "boxH": "═",
  "boxHD": "╦",
  "boxHU": "╩",
  "boxHd": "╤",
  "boxHu": "╧",
  "boxUL": "╝",
  "boxUR": "╚",
  "boxUl": "╜",
  "boxUr": "╙",
  "boxV": "║",
  "boxVH": "╬",
  "boxVL": "╣",
  "boxVR": "╠",
  "boxVh": "╫",
  "boxVl": "╢",
  "boxVr": "╟",
  "boxbox": "⧉",
  "boxdL": "╕",
  "boxdR": "╒",
  "boxdl": "┐",
  "boxdr": "┌",
  "boxhD": "╥",
  "boxhU": "╨",
  "boxhd": "┬",
  "boxhu": "┴",
  "boxminus": "⊟",
  "minusb": "⊟",
  "boxplus": "⊞",
  "plusb": "⊞",
  "boxtimes": "⊠",
  "timesb": "⊠",
  "boxuL": "╛",
  "boxuR": "╘",
  "boxul": "┘",
  "boxur": "└",
  "boxv": "│",
  "boxvH": "╪",
  "boxvL": "╡",
  "boxvR": "╞",
  "boxvh": "┼",
  "boxvl": "┤",
  "boxvr": "├",
  "brvbar": "¦",
  "bscr": "𝒷",
  "bsemi": "⁏",
  "bsol": "\\",
  "bsolb": "⧅",
  "bsolhsub": "⟈",
  "bull": "•",
  "bullet": "•",
  "bumpE": "⪮",
  "cacute": "ć",
  "cap": "∩",
  "capand": "⩄",
  "capbrcup": "⩉",
  "capcap": "⩋",
  "capcup": "⩇",
  "capdot": "⩀",
  "caps": "∩︀",
  "caret": "⁁",
  "ccaps": "⩍",
  "ccaron": "č",
  "ccedil": "ç",
  "ccirc": "ĉ",
  "ccups": "⩌",
  "ccupssm": "⩐",
  "cdot": "ċ",
  "cemptyv": "⦲",
  "cent": "¢",
  "cfr": "𝔠",
  "chcy": "ч",
  "check": "✓",
  "checkmark": "✓",
  "chi": "χ",
  "cir": "○",
  "cirE": "⧃",
  "circ": "ˆ",
  "circeq": "≗",
  "cire": "≗",
  "circlearrowleft": "↺",
  "olarr": "↺",
  "circlearrowright": "↻",
  "orarr": "↻",
  "circledS": "Ⓢ",
  "oS": "Ⓢ",
  "circledast": "⊛",
  "oast": "⊛",
  "circledcirc": "⊚",
  "ocir": "⊚",
  "circleddash": "⊝",
  "odash": "⊝",
  "cirfnint": "⨐",
  "cirmid": "⫯",
  "cirscir": "⧂",
  "clubs": "♣",
  "clubsuit": "♣",
  "colon": ":",
  "comma": ",",
  "commat": "@",
  "comp": "∁",
  "complement": "∁",
  "congdot": "⩭",
  "copf": "𝕔",
  "copysr": "℗",
  "crarr": "↵",
  "cross": "✗",
  "cscr": "𝒸",
  "csub": "⫏",
  "csube": "⫑",
  "csup": "⫐",
  "csupe": "⫒",
  "ctdot": "⋯",
  "cudarrl": "⤸",
  "cudarrr": "⤵",
  "cuepr": "⋞",
  "curlyeqprec": "⋞",
  "cuesc": "⋟",
  "curlyeqsucc": "⋟",
  "cularr": "↶",
  "curvearrowleft": "↶",
  "cularrp": "⤽",
  "cup": "∪",
  "cupbrcap": "⩈",
  "cupcap": "⩆",
  "cupcup": "⩊",
  "cupdot": "⊍",
  "cupor": "⩅",
  "cups": "∪︀",
  "curarr": "↷",
  "curvearrowright": "↷",
  "curarrm": "⤼",
  "curlyvee": "⋎",
  "cuvee": "⋎",
  "curlywedge": "⋏",
  "cuwed": "⋏",
  "curren": "¤",
  "cwint": "∱",
  "cylcty": "⌭",
  "dHar": "⥥",
  "dagger": "†",
  "daleth": "ℸ",
  "dash": "‐",
  "hyphen": "‐",
  "dbkarow": "⤏",
  "rBarr": "⤏",
  "dcaron": "ď",
  "dcy": "д",
  "ddarr": "⇊",
  "downdownarrows": "⇊",
  "ddotseq": "⩷",
  "eDDot": "⩷",
  "deg": "°",
  "delta": "δ",
  "demptyv": "⦱",
  "dfisht": "⥿",
  "dfr": "𝔡",
  "diamondsuit": "♦",
  "diams": "♦",
  "digamma": "ϝ",
  "gammad": "ϝ",
  "disin": "⋲",
  "div": "÷",
  "divide": "÷",
  "divideontimes": "⋇",
  "divonx": "⋇",
  "djcy": "ђ",
  "dlcorn": "⌞",
  "llcorner": "⌞",
  "dlcrop": "⌍",
  "dollar": "$",
  "dopf": "𝕕",
  "doteqdot": "≑",
  "eDot": "≑",
  "dotminus": "∸",
  "minusd": "∸",
  "dotplus": "∔",
  "plusdo": "∔",
  "dotsquare": "⊡",
  "sdotb": "⊡",
  "drcorn": "⌟",
  "lrcorner": "⌟",
  "drcrop": "⌌",
  "dscr": "𝒹",
  "dscy": "ѕ",
  "dsol": "⧶",
  "dstrok": "đ",
  "dtdot": "⋱",
  "dtri": "▿",
  "triangledown": "▿",
  "dwangle": "⦦",
  "dzcy": "џ",
  "dzigrarr": "⟿",
  "eacute": "é",
  "easter": "⩮",
  "ecaron": "ě",
  "ecir": "≖",
  "eqcirc": "≖",
  "ecirc": "ê",
  "ecolon": "≕",
  "eqcolon": "≕",
  "ecy": "э",
  "edot": "ė",
  "efDot": "≒",
  "fallingdotseq": "≒",
  "efr": "𝔢",
  "eg": "⪚",
  "egrave": "è",
  "egs": "⪖",
  "eqslantgtr": "⪖",
  "egsdot": "⪘",
  "el": "⪙",
  "elinters": "⏧",
  "ell": "ℓ",
  "els": "⪕",
  "eqslantless": "⪕",
  "elsdot": "⪗",
  "emacr": "ē",
  "empty": "∅",
  "emptyset": "∅",
  "emptyv": "∅",
  "varnothing": "∅",
  "emsp13": " ",
  "emsp14": " ",
  "emsp": " ",
  "eng": "ŋ",
  "ensp": " ",
  "eogon": "ę",
  "eopf": "𝕖",
  "epar": "⋕",
  "eparsl": "⧣",
  "eplus": "⩱",
  "epsi": "ε",
  "epsilon": "ε",
  "epsiv": "ϵ",
  "straightepsilon": "ϵ",
  "varepsilon": "ϵ",
  "equals": "=",
  "equest": "≟",
  "questeq": "≟",
  "equivDD": "⩸",
  "eqvparsl": "⧥",
  "erDot": "≓",
  "risingdotseq": "≓",
  "erarr": "⥱",
  "escr": "ℯ",
  "eta": "η",
  "eth": "ð",
  "euml": "ë",
  "euro": "€",
  "excl": "!",
  "fcy": "ф",
  "female": "♀",
  "ffilig": "ﬃ",
  "fflig": "ﬀ",
  "ffllig": "ﬄ",
  "ffr": "𝔣",
  "filig": "ﬁ",
  "fjlig": "fj",
  "flat": "♭",
  "fllig": "ﬂ",
  "fltns": "▱",
  "fnof": "ƒ",
  "fopf": "𝕗",
  "fork": "⋔",
  "pitchfork": "⋔",
  "forkv": "⫙",
  "fpartint": "⨍",
  "frac12": "½",
  "half": "½",
  "frac13": "⅓",
  "frac14": "¼",
  "frac15": "⅕",
  "frac16": "⅙",
  "frac18": "⅛",
  "frac23": "⅔",
  "frac25": "⅖",
  "frac34": "¾",
  "frac35": "⅗",
  "frac38": "⅜",
  "frac45": "⅘",
  "frac56": "⅚",
  "frac58": "⅝",
  "frac78": "⅞",
  "frasl": "⁄",
  "frown": "⌢",
  "sfrown": "⌢",
  "fscr": "𝒻",
  "gEl": "⪌",
  "gtreqqless": "⪌",
  "gacute": "ǵ",
  "gamma": "γ",
  "gap": "⪆",
  "gtrapprox": "⪆",
  "gbreve": "ğ",
  "gcirc": "ĝ",
  "gcy": "г",
  "gdot": "ġ",
  "gescc": "⪩",
  "gesdot": "⪀",
  "gesdoto": "⪂",
  "gesdotol": "⪄",
  "gesl": "⋛︀",
  "gesles": "⪔",
  "gfr": "𝔤",
  "gimel": "ℷ",
  "gjcy": "ѓ",
  "glE": "⪒",
  "gla": "⪥",
  "glj": "⪤",
  "gnE": "≩",
  "gneqq": "≩",
  "gnap": "⪊",
  "gnapprox": "⪊",
  "gne": "⪈",
  "gneq": "⪈",
  "gnsim": "⋧",
  "gopf": "𝕘",
  "gscr": "ℊ",
  "gsime": "⪎",
  "gsiml": "⪐",
  "gtcc": "⪧",
  "gtcir": "⩺",
  "gtdot": "⋗",
  "gtrdot": "⋗",
  "gtlPar": "⦕",
  "gtquest": "⩼",
  "gtrarr": "⥸",
  "gvertneqq": "≩︀",
  "gvnE": "≩︀",
  "hardcy": "ъ",
  "harrcir": "⥈",
  "harrw": "↭",
  "leftrightsquigarrow": "↭",
  "hbar": "ℏ",
  "hslash": "ℏ",
  "planck": "ℏ",
  "plankv": "ℏ",
  "hcirc": "ĥ",
  "hearts": "♥",
  "heartsuit": "♥",
  "hellip": "…",
  "mldr": "…",
  "hercon": "⊹",
  "hfr": "𝔥",
  "hksearow": "⤥",
  "searhk": "⤥",
  "hkswarow": "⤦",
  "swarhk": "⤦",
  "hoarr": "⇿",
  "homtht": "∻",
  "hookleftarrow": "↩",
  "larrhk": "↩",
  "hookrightarrow": "↪",
  "rarrhk": "↪",
  "hopf": "𝕙",
  "horbar": "―",
  "hscr": "𝒽",
  "hstrok": "ħ",
  "hybull": "⁃",
  "iacute": "í",
  "icirc": "î",
  "icy": "и",
  "iecy": "е",
  "iexcl": "¡",
  "ifr": "𝔦",
  "igrave": "ì",
  "iiiint": "⨌",
  "qint": "⨌",
  "iiint": "∭",
  "tint": "∭",
  "iinfin": "⧜",
  "iiota": "℩",
  "ijlig": "ĳ",
  "imacr": "ī",
  "imath": "ı",
  "inodot": "ı",
  "imof": "⊷",
  "imped": "Ƶ",
  "incare": "℅",
  "infin": "∞",
  "infintie": "⧝",
  "intcal": "⊺",
  "intercal": "⊺",
  "intlarhk": "⨗",
  "intprod": "⨼",
  "iprod": "⨼",
  "iocy": "ё",
  "iogon": "į",
  "iopf": "𝕚",
  "iota": "ι",
  "iquest": "¿",
  "iscr": "𝒾",
  "isinE": "⋹",
  "isindot": "⋵",
  "isins": "⋴",
  "isinsv": "⋳",
  "itilde": "ĩ",
  "iukcy": "і",
  "iuml": "ï",
  "jcirc": "ĵ",
  "jcy": "й",
  "jfr": "𝔧",
  "jmath": "ȷ",
  "jopf": "𝕛",
  "jscr": "𝒿",
  "jsercy": "ј",
  "jukcy": "є",
  "kappa": "κ",
  "kappav": "ϰ",
  "varkappa": "ϰ",
  "kcedil": "ķ",
  "kcy": "к",
  "kfr": "𝔨",
  "kgreen": "ĸ",
  "khcy": "х",
  "kjcy": "ќ",
  "kopf": "𝕜",
  "kscr": "𝓀",
  "lAtail": "⤛",
  "lBarr": "⤎",
  "lEg": "⪋",
  "lesseqqgtr": "⪋",
  "lHar": "⥢",
  "lacute": "ĺ",
  "laemptyv": "⦴",
  "lambda": "λ",
  "langd": "⦑",
  "lap": "⪅",
  "lessapprox": "⪅",
  "laquo": "«",
  "larrbfs": "⤟",
  "larrfs": "⤝",
  "larrlp": "↫",
  "looparrowleft": "↫",
  "larrpl": "⤹",
  "larrsim": "⥳",
  "larrtl": "↢",
  "leftarrowtail": "↢",
  "lat": "⪫",
  "latail": "⤙",
  "late": "⪭",
  "lates": "⪭︀",
  "lbarr": "⤌",
  "lbbrk": "❲",
  "lbrace": "{",
  "lcub": "{",
  "lbrack": "[",
  "lsqb": "[",
  "lbrke": "⦋",
  "lbrksld": "⦏",
  "lbrkslu": "⦍",
  "lcaron": "ľ",
  "lcedil": "ļ",
  "lcy": "л",
  "ldca": "⤶",
  "ldrdhar": "⥧",
  "ldrushar": "⥋",
  "ldsh": "↲",
  "le": "≤",
  "leq": "≤",
  "leftleftarrows": "⇇",
  "llarr": "⇇",
  "leftthreetimes": "⋋",
  "lthree": "⋋",
  "lescc": "⪨",
  "lesdot": "⩿",
  "lesdoto": "⪁",
  "lesdotor": "⪃",
  "lesg": "⋚︀",
  "lesges": "⪓",
  "lessdot": "⋖",
  "ltdot": "⋖",
  "lfisht": "⥼",
  "lfr": "𝔩",
  "lgE": "⪑",
  "lharul": "⥪",
  "lhblk": "▄",
  "ljcy": "љ",
  "llhard": "⥫",
  "lltri": "◺",
  "lmidot": "ŀ",
  "lmoust": "⎰",
  "lmoustache": "⎰",
  "lnE": "≨",
  "lneqq": "≨",
  "lnap": "⪉",
  "lnapprox": "⪉",
  "lne": "⪇",
  "lneq": "⪇",
  "lnsim": "⋦",
  "loang": "⟬",
  "loarr": "⇽",
  "longmapsto": "⟼",
  "xmap": "⟼",
  "looparrowright": "↬",
  "rarrlp": "↬",
  "lopar": "⦅",
  "lopf": "𝕝",
  "loplus": "⨭",
  "lotimes": "⨴",
  "lowast": "∗",
  "loz": "◊",
  "lozenge": "◊",
  "lpar": "(",
  "lparlt": "⦓",
  "lrhard": "⥭",
  "lrm": "‎",
  "lrtri": "⊿",
  "lsaquo": "‹",
  "lscr": "𝓁",
  "lsime": "⪍",
  "lsimg": "⪏",
  "lsquor": "‚",
  "sbquo": "‚",
  "lstrok": "ł",
  "ltcc": "⪦",
  "ltcir": "⩹",
  "ltimes": "⋉",
  "ltlarr": "⥶",
  "ltquest": "⩻",
  "ltrPar": "⦖",
  "ltri": "◃",
  "triangleleft": "◃",
  "lurdshar": "⥊",
  "luruhar": "⥦",
  "lvertneqq": "≨︀",
  "lvnE": "≨︀",
  "mDDot": "∺",
  "macr": "¯",
  "strns": "¯",
  "male": "♂",
  "malt": "✠",
  "maltese": "✠",
  "marker": "▮",
  "mcomma": "⨩",
  "mcy": "м",
  "mdash": "—",
  "mfr": "𝔪",
  "mho": "℧",
  "micro": "µ",
  "midcir": "⫰",
  "minus": "−",
  "minusdu": "⨪",
  "mlcp": "⫛",
  "models": "⊧",
  "mopf": "𝕞",
  "mscr": "𝓂",
  "mu": "μ",
  "multimap": "⊸",
  "mumap": "⊸",
  "nGg": "⋙̸",
  "nGt": "≫⃒",
  "nLeftarrow": "⇍",
  "nlArr": "⇍",
  "nLeftrightarrow": "⇎",
  "nhArr": "⇎",
  "nLl": "⋘̸",
  "nLt": "≪⃒",
  "nRightarrow": "⇏",
  "nrArr": "⇏",
  "nVDash": "⊯",
  "nVdash": "⊮",
  "nacute": "ń",
  "nang": "∠⃒",
  "napE": "⩰̸",
  "napid": "≋̸",
  "napos": "ŉ",
  "natur": "♮",
  "natural": "♮",
  "ncap": "⩃",
  "ncaron": "ň",
  "ncedil": "ņ",
  "ncongdot": "⩭̸",
  "ncup": "⩂",
  "ncy": "н",
  "ndash": "–",
  "neArr": "⇗",
  "nearhk": "⤤",
  "nedot": "≐̸",
  "nesear": "⤨",
  "toea": "⤨",
  "nfr": "𝔫",
  "nharr": "↮",
  "nleftrightarrow": "↮",
  "nhpar": "⫲",
  "nis": "⋼",
  "nisd": "⋺",
  "njcy": "њ",
  "nlE": "≦̸",
  "nleqq": "≦̸",
  "nlarr": "↚",
  "nleftarrow": "↚",
  "nldr": "‥",
  "nopf": "𝕟",
  "not": "¬",
  "notinE": "⋹̸",
  "notindot": "⋵̸",
  "notinvb": "⋷",
  "notinvc": "⋶",
  "notnivb": "⋾",
  "notnivc": "⋽",
  "nparsl": "⫽⃥",
  "npart": "∂̸",
  "npolint": "⨔",
  "nrarr": "↛",
  "nrightarrow": "↛",
  "nrarrc": "⤳̸",
  "nrarrw": "↝̸",
  "nscr": "𝓃",
  "nsub": "⊄",
  "nsubE": "⫅̸",
  "nsubseteqq": "⫅̸",
  "nsup": "⊅",
  "nsupE": "⫆̸",
  "nsupseteqq": "⫆̸",
  "ntilde": "ñ",
  "nu": "ν",
  "num": "#",
  "numero": "№",
  "numsp": " ",
  "nvDash": "⊭",
  "nvHarr": "⤄",
  "nvap": "≍⃒",
  "nvdash": "⊬",
  "nvge": "≥⃒",
  "nvgt": ">⃒",
  "nvinfin": "⧞",
  "nvlArr": "⤂",
  "nvle": "≤⃒",
  "nvlt": "<⃒",
  "nvltrie": "⊴⃒",
  "nvrArr": "⤃",
  "nvrtrie": "⊵⃒",
  "nvsim": "∼⃒",
  "nwArr": "⇖",
  "nwarhk": "⤣",
  "nwnear": "⤧",
  "oacute": "ó",
  "ocirc": "ô",
  "ocy": "о",
  "odblac": "ő",
  "odiv": "⨸",
  "odsold": "⦼",
  "oelig": "œ",
  "ofcir": "⦿",
  "ofr": "𝔬",
  "ogon": "˛",
  "ograve": "ò",
  "ogt": "⧁",
  "ohbar": "⦵",
  "olcir": "⦾",
  "olcross": "⦻",
  "olt": "⧀",
  "omacr": "ō",
  "omega": "ω",
  "omicron": "ο",
  "omid": "⦶",
  "oopf": "𝕠",
  "opar": "⦷",
  "operp": "⦹",
  "or": "∨",
  "vee": "∨",
  "ord": "⩝",
  "order": "ℴ",
  "orderof": "ℴ",
  "oscr": "ℴ",
  "ordf": "ª",
  "ordm": "º",
  "origof": "⊶",
  "oror": "⩖",
  "orslope": "⩗",
  "orv": "⩛",
  "oslash": "ø",
  "osol": "⊘",
  "otilde": "õ",
  "otimesas": "⨶",
  "ouml": "ö",
  "ovbar": "⌽",
  "para": "¶",
  "parsim": "⫳",
  "parsl": "⫽",
  "pcy": "п",
  "percnt": "%",
  "period": ".",
  "permil": "‰",
  "pertenk": "‱",
  "pfr": "𝔭",
  "phi": "φ",
  "phiv": "ϕ",
  "straightphi": "ϕ",
  "varphi": "ϕ",
  "phone": "☎",
  "pi": "π",
  "piv": "ϖ",
  "varpi": "ϖ",
  "planckh": "ℎ",
  "plus": "+",
  "plusacir": "⨣",
  "pluscir": "⨢",
  "plusdu": "⨥",
  "pluse": "⩲",
  "plussim": "⨦",
  "plustwo": "⨧",
  "pointint": "⨕",
  "popf": "𝕡",
  "pound": "£",
  "prE": "⪳",
  "prap": "⪷",
  "precapprox": "⪷",
  "precnapprox": "⪹",
  "prnap": "⪹",
  "precneqq": "⪵",
  "prnE": "⪵",
  "precnsim": "⋨",
  "prnsim": "⋨",
  "prime": "′",
  "profalar": "⌮",
  "profline": "⌒",
  "profsurf": "⌓",
  "prurel": "⊰",
  "pscr": "𝓅",
  "psi": "ψ",
  "puncsp": " ",
  "qfr": "𝔮",
  "qopf": "𝕢",
  "qprime": "⁗",
  "qscr": "𝓆",
  "quatint": "⨖",
  "quest": "?",
  "rAtail": "⤜",
  "rHar": "⥤",
  "race": "∽̱",
  "racute": "ŕ",
  "raemptyv": "⦳",
  "rangd": "⦒",
  "range": "⦥",
  "raquo": "»",
  "rarrap": "⥵",
  "rarrbfs": "⤠",
  "rarrc": "⤳",
  "rarrfs": "⤞",
  "rarrpl": "⥅",
  "rarrsim": "⥴",
  "rarrtl": "↣",
  "rightarrowtail": "↣",
  "rarrw": "↝",
  "rightsquigarrow": "↝",
  "ratail": "⤚",
  "ratio": "∶",
  "rbbrk": "❳",
  "rbrace": "}",
  "rcub": "}",
  "rbrack": "]",
  "rsqb": "]",
  "rbrke": "⦌",
  "rbrksld": "⦎",
  "rbrkslu": "⦐",
  "rcaron": "ř",
  "rcedil": "ŗ",
  "rcy": "р",
  "rdca": "⤷",
  "rdldhar": "⥩",
  "rdsh": "↳",
  "rect": "▭",
  "rfisht": "⥽",
  "rfr": "𝔯",
  "rharul": "⥬",
  "rho": "ρ",
  "rhov": "ϱ",
  "varrho": "ϱ",
  "rightrightarrows": "⇉",
  "rrarr": "⇉",
  "rightthreetimes": "⋌",
  "rthree": "⋌",
  "ring": "˚",
  "rlm": "‏",
  "rmoust": "⎱",
  "rmoustache": "⎱",
  "rnmid": "⫮",
  "roang": "⟭",
  "roarr": "⇾",
  "ropar": "⦆",
  "ropf": "𝕣",
  "roplus": "⨮",
  "rotimes": "⨵",
  "rpar": ")",
  "rpargt": "⦔",
  "rppolint": "⨒",
  "rsaquo": "›",
  "rscr": "𝓇",
  "rtimes": "⋊",
  "rtri": "▹",
  "triangleright": "▹",
  "rtriltri": "⧎",
  "ruluhar": "⥨",
  "rx": "℞",
  "sacute": "ś",
  "scE": "⪴",
  "scap": "⪸",
  "succapprox": "⪸",
  "scaron": "š",
  "scedil": "ş",
  "scirc": "ŝ",
  "scnE": "⪶",
  "succneqq": "⪶",
  "scnap": "⪺",
  "succnapprox": "⪺",
  "scnsim": "⋩",
  "succnsim": "⋩",
  "scpolint": "⨓",
  "scy": "с",
  "sdot": "⋅",
  "sdote": "⩦",
  "seArr": "⇘",
  "sect": "§",
  "semi": ";",
  "seswar": "⤩",
  "tosa": "⤩",
  "sext": "✶",
  "sfr": "𝔰",
  "sharp": "♯",
  "shchcy": "щ",
  "shcy": "ш",
  "shy": "­",
  "sigma": "σ",
  "sigmaf": "ς",
  "sigmav": "ς",
  "varsigma": "ς",
  "simdot": "⩪",
  "simg": "⪞",
  "simgE": "⪠",
  "siml": "⪝",
  "simlE": "⪟",
  "simne": "≆",
  "simplus": "⨤",
  "simrarr": "⥲",
  "smashp": "⨳",
  "smeparsl": "⧤",
  "smile": "⌣",
  "ssmile": "⌣",
  "smt": "⪪",
  "smte": "⪬",
  "smtes": "⪬︀",
  "softcy": "ь",
  "sol": "/",
  "solb": "⧄",
  "solbar": "⌿",
  "sopf": "𝕤",
  "spades": "♠",
  "spadesuit": "♠",
  "sqcaps": "⊓︀",
  "sqcups": "⊔︀",
  "sscr": "𝓈",
  "star": "☆",
  "sub": "⊂",
  "subset": "⊂",
  "subE": "⫅",
  "subseteqq": "⫅",
  "subdot": "⪽",
  "subedot": "⫃",
  "submult": "⫁",
  "subnE": "⫋",
  "subsetneqq": "⫋",
  "subne": "⊊",
  "subsetneq": "⊊",
  "subplus": "⪿",
  "subrarr": "⥹",
  "subsim": "⫇",
  "subsub": "⫕",
  "subsup": "⫓",
  "sung": "♪",
  "sup1": "¹",
  "sup2": "²",
  "sup3": "³",
  "supE": "⫆",
  "supseteqq": "⫆",
  "supdot": "⪾",
  "supdsub": "⫘",
  "supedot": "⫄",
  "suphsol": "⟉",
  "suphsub": "⫗",
  "suplarr": "⥻",
  "supmult": "⫂",
  "supnE": "⫌",
  "supsetneqq": "⫌",
  "supne": "⊋",
  "supsetneq": "⊋",
  "supplus": "⫀",
  "supsim": "⫈",
  "supsub": "⫔",
  "supsup": "⫖",
  "swArr": "⇙",
  "swnwar": "⤪",
  "szlig": "ß",
  "target": "⌖",
  "tau": "τ",
  "tcaron": "ť",
  "tcedil": "ţ",
  "tcy": "т",
  "telrec": "⌕",
  "tfr": "𝔱",
  "theta": "θ",
  "thetasym": "ϑ",
  "thetav": "ϑ",
  "vartheta": "ϑ",
  "thorn": "þ",
  "times": "×",
  "timesbar": "⨱",
  "timesd": "⨰",
  "topbot": "⌶",
  "topcir": "⫱",
  "topf": "𝕥",
  "topfork": "⫚",
  "tprime": "‴",
  "triangle": "▵",
  "utri": "▵",
  "triangleq": "≜",
  "trie": "≜",
  "tridot": "◬",
  "triminus": "⨺",
  "triplus": "⨹",
  "trisb": "⧍",
  "tritime": "⨻",
  "trpezium": "⏢",
  "tscr": "𝓉",
  "tscy": "ц",
  "tshcy": "ћ",
  "tstrok": "ŧ",
  "uHar": "⥣",
  "uacute": "ú",
  "ubrcy": "ў",
  "ubreve": "ŭ",
  "ucirc": "û",
  "ucy": "у",
  "udblac": "ű",
  "ufisht": "⥾",
  "ufr": "𝔲",
  "ugrave": "ù",
  "uhblk": "▀",
  "ulcorn": "⌜",
  "ulcorner": "⌜",
  "ulcrop": "⌏",
  "ultri": "◸",
  "umacr": "ū",
  "uogon": "ų",
  "uopf": "𝕦",
  "upsi": "υ",
  "upsilon": "υ",
  "upuparrows": "⇈",
  "uuarr": "⇈",
  "urcorn": "⌝",
  "urcorner": "⌝",
  "urcrop": "⌎",
  "uring": "ů",
  "urtri": "◹",
  "uscr": "𝓊",
  "utdot": "⋰",
  "utilde": "ũ",
  "uuml": "ü",
  "uwangle": "⦧",
  "vBar": "⫨",
  "vBarv": "⫩",
  "vangrt": "⦜",
  "varsubsetneq": "⊊︀",
  "vsubne": "⊊︀",
  "varsubsetneqq": "⫋︀",
  "vsubnE": "⫋︀",
  "varsupsetneq": "⊋︀",
  "vsupne": "⊋︀",
  "varsupsetneqq": "⫌︀",
  "vsupnE": "⫌︀",
  "vcy": "в",
  "veebar": "⊻",
  "veeeq": "≚",
  "vellip": "⋮",
  "vfr": "𝔳",
  "vopf": "𝕧",
  "vscr": "𝓋",
  "vzigzag": "⦚",
  "wcirc": "ŵ",
  "wedbar": "⩟",
  "wedgeq": "≙",
  "weierp": "℘",
  "wp": "℘",
  "wfr": "𝔴",
  "wopf": "𝕨",
  "wscr": "𝓌",
  "xfr": "𝔵",
  "xi": "ξ",
  "xnis": "⋻",
  "xopf": "𝕩",
  "xscr": "𝓍",
  "yacute": "ý",
  "yacy": "я",
  "ycirc": "ŷ",
  "ycy": "ы",
  "yen": "¥",
  "yfr": "𝔶",
  "yicy": "ї",
  "yopf": "𝕪",
  "yscr": "𝓎",
  "yucy": "ю",
  "yuml": "ÿ",
  "zacute": "ź",
  "zcaron": "ž",
  "zcy": "з",
  "zdot": "ż",
  "zeta": "ζ",
  "zfr": "𝔷",
  "zhcy": "ж",
  "zigrarr": "⇝",
  "zopf": "𝕫",
  "zscr": "𝓏",
  "zwj": "‍",
  "zwnj": "‌"
};
const NGSP_UNICODE = "";
NAMED_ENTITIES["ngsp"] = NGSP_UNICODE;
class TokenError extends ParseError {
  tokenType;
  constructor(errorMsg, tokenType, span) {
    super(span, errorMsg);
    this.tokenType = tokenType;
  }
}
class TokenizeResult {
  tokens;
  errors;
  nonNormalizedIcuExpressions;
  constructor(tokens, errors, nonNormalizedIcuExpressions) {
    this.tokens = tokens;
    this.errors = errors;
    this.nonNormalizedIcuExpressions = nonNormalizedIcuExpressions;
  }
}
function tokenize(source, url, getTagDefinition, options = {}) {
  const tokenizer = new _Tokenizer(new ParseSourceFile(source, url), getTagDefinition, options);
  tokenizer.tokenize();
  return new TokenizeResult(mergeTextTokens(tokenizer.tokens), tokenizer.errors, tokenizer.nonNormalizedIcuExpressions);
}
const _CR_OR_CRLF_REGEXP = /\r\n?/g;
function _unexpectedCharacterErrorMsg(charCode) {
  const char = charCode === $EOF ? "EOF" : String.fromCharCode(charCode);
  return `Unexpected character "${char}"`;
}
function _unknownEntityErrorMsg(entitySrc) {
  return `Unknown entity "${entitySrc}" - use the "&#<decimal>;" or  "&#x<hex>;" syntax`;
}
function _unparsableEntityErrorMsg(type, entityStr) {
  return `Unable to parse entity "${entityStr}" - ${type} character reference entities must end with ";"`;
}
var CharacterReferenceType;
(function(CharacterReferenceType2) {
  CharacterReferenceType2["HEX"] = "hexadecimal";
  CharacterReferenceType2["DEC"] = "decimal";
})(CharacterReferenceType || (CharacterReferenceType = {}));
class _ControlFlowError {
  error;
  constructor(error2) {
    this.error = error2;
  }
}
class _Tokenizer {
  _getTagDefinition;
  _cursor;
  _tokenizeIcu;
  _interpolationConfig;
  _leadingTriviaCodePoints;
  _currentTokenStart = null;
  _currentTokenType = null;
  _expansionCaseStack = [];
  _inInterpolation = false;
  _preserveLineEndings;
  _i18nNormalizeLineEndingsInICUs;
  _tokenizeBlocks;
  _tokenizeLet;
  tokens = [];
  errors = [];
  nonNormalizedIcuExpressions = [];
  /**
   * @param _file The html source file being tokenized.
   * @param _getTagDefinition A function that will retrieve a tag definition for a given tag name.
   * @param options Configuration of the tokenization.
   */
  constructor(_file, _getTagDefinition, options) {
    this._getTagDefinition = _getTagDefinition;
    this._tokenizeIcu = options.tokenizeExpansionForms || false;
    this._interpolationConfig = options.interpolationConfig || DEFAULT_INTERPOLATION_CONFIG;
    this._leadingTriviaCodePoints = options.leadingTriviaChars && options.leadingTriviaChars.map((c) => c.codePointAt(0) || 0);
    const range = options.range || {
      endPos: _file.content.length,
      startPos: 0,
      startLine: 0,
      startCol: 0
    };
    this._cursor = options.escapedString ? new EscapedCharacterCursor(_file, range) : new PlainCharacterCursor(_file, range);
    this._preserveLineEndings = options.preserveLineEndings || false;
    this._i18nNormalizeLineEndingsInICUs = options.i18nNormalizeLineEndingsInICUs || false;
    this._tokenizeBlocks = options.tokenizeBlocks ?? true;
    this._tokenizeLet = options.tokenizeLet ?? true;
    try {
      this._cursor.init();
    } catch (e) {
      this.handleError(e);
    }
  }
  _processCarriageReturns(content) {
    if (this._preserveLineEndings) {
      return content;
    }
    return content.replace(_CR_OR_CRLF_REGEXP, "\n");
  }
  tokenize() {
    while (this._cursor.peek() !== $EOF) {
      const start = this._cursor.clone();
      try {
        if (this._attemptCharCode($LT)) {
          if (this._attemptCharCode($BANG)) {
            if (this._attemptCharCode($LBRACKET)) {
              this._consumeCdata(start);
            } else if (this._attemptCharCode($MINUS)) {
              this._consumeComment(start);
            } else {
              this._consumeDocType(start);
            }
          } else if (this._attemptCharCode($SLASH)) {
            this._consumeTagClose(start);
          } else {
            this._consumeTagOpen(start);
          }
        } else if (this._tokenizeLet && // Use `peek` instead of `attempCharCode` since we
        // don't want to advance in case it's not `@let`.
        this._cursor.peek() === $AT && !this._inInterpolation && this._attemptStr("@let")) {
          this._consumeLetDeclaration(start);
        } else if (this._tokenizeBlocks && this._attemptCharCode($AT)) {
          this._consumeBlockStart(start);
        } else if (this._tokenizeBlocks && !this._inInterpolation && !this._isInExpansionCase() && !this._isInExpansionForm() && this._attemptCharCode($RBRACE)) {
          this._consumeBlockEnd(start);
        } else if (!(this._tokenizeIcu && this._tokenizeExpansionForm())) {
          this._consumeWithInterpolation(5, 8, () => this._isTextEnd(), () => this._isTagStart());
        }
      } catch (e) {
        this.handleError(e);
      }
    }
    this._beginToken(
      33
      /* TokenType.EOF */
    );
    this._endToken([]);
  }
  _getBlockName() {
    let spacesInNameAllowed = false;
    const nameCursor = this._cursor.clone();
    this._attemptCharCodeUntilFn((code) => {
      if (isWhitespace(code)) {
        return !spacesInNameAllowed;
      }
      if (isBlockNameChar(code)) {
        spacesInNameAllowed = true;
        return false;
      }
      return true;
    });
    return this._cursor.getChars(nameCursor).trim();
  }
  _consumeBlockStart(start) {
    this._beginToken(24, start);
    const startToken = this._endToken([this._getBlockName()]);
    if (this._cursor.peek() === $LPAREN) {
      this._cursor.advance();
      this._consumeBlockParameters();
      this._attemptCharCodeUntilFn(isNotWhitespace);
      if (this._attemptCharCode($RPAREN)) {
        this._attemptCharCodeUntilFn(isNotWhitespace);
      } else {
        startToken.type = 28;
        return;
      }
    }
    if (this._attemptCharCode($LBRACE)) {
      this._beginToken(
        25
        /* TokenType.BLOCK_OPEN_END */
      );
      this._endToken([]);
    } else {
      startToken.type = 28;
    }
  }
  _consumeBlockEnd(start) {
    this._beginToken(26, start);
    this._endToken([]);
  }
  _consumeBlockParameters() {
    this._attemptCharCodeUntilFn(isBlockParameterChar);
    while (this._cursor.peek() !== $RPAREN && this._cursor.peek() !== $EOF) {
      this._beginToken(
        27
        /* TokenType.BLOCK_PARAMETER */
      );
      const start = this._cursor.clone();
      let inQuote = null;
      let openParens = 0;
      while (this._cursor.peek() !== $SEMICOLON && this._cursor.peek() !== $EOF || inQuote !== null) {
        const char = this._cursor.peek();
        if (char === $BACKSLASH) {
          this._cursor.advance();
        } else if (char === inQuote) {
          inQuote = null;
        } else if (inQuote === null && isQuote(char)) {
          inQuote = char;
        } else if (char === $LPAREN && inQuote === null) {
          openParens++;
        } else if (char === $RPAREN && inQuote === null) {
          if (openParens === 0) {
            break;
          } else if (openParens > 0) {
            openParens--;
          }
        }
        this._cursor.advance();
      }
      this._endToken([this._cursor.getChars(start)]);
      this._attemptCharCodeUntilFn(isBlockParameterChar);
    }
  }
  _consumeLetDeclaration(start) {
    this._beginToken(29, start);
    if (isWhitespace(this._cursor.peek())) {
      this._attemptCharCodeUntilFn(isNotWhitespace);
    } else {
      const token = this._endToken([this._cursor.getChars(start)]);
      token.type = 32;
      return;
    }
    const startToken = this._endToken([this._getLetDeclarationName()]);
    this._attemptCharCodeUntilFn(isNotWhitespace);
    if (!this._attemptCharCode($EQ)) {
      startToken.type = 32;
      return;
    }
    this._attemptCharCodeUntilFn((code) => isNotWhitespace(code) && !isNewLine(code));
    this._consumeLetDeclarationValue();
    const endChar = this._cursor.peek();
    if (endChar === $SEMICOLON) {
      this._beginToken(
        31
        /* TokenType.LET_END */
      );
      this._endToken([]);
      this._cursor.advance();
    } else {
      startToken.type = 32;
      startToken.sourceSpan = this._cursor.getSpan(start);
    }
  }
  _getLetDeclarationName() {
    const nameCursor = this._cursor.clone();
    let allowDigit = false;
    this._attemptCharCodeUntilFn((code) => {
      if (isAsciiLetter(code) || code === $$ || code === $_ || // `@let` names can't start with a digit, but digits are valid anywhere else in the name.
      allowDigit && isDigit(code)) {
        allowDigit = true;
        return false;
      }
      return true;
    });
    return this._cursor.getChars(nameCursor).trim();
  }
  _consumeLetDeclarationValue() {
    const start = this._cursor.clone();
    this._beginToken(30, start);
    while (this._cursor.peek() !== $EOF) {
      const char = this._cursor.peek();
      if (char === $SEMICOLON) {
        break;
      }
      if (isQuote(char)) {
        this._cursor.advance();
        this._attemptCharCodeUntilFn((inner) => {
          if (inner === $BACKSLASH) {
            this._cursor.advance();
            return false;
          }
          return inner === char;
        });
      }
      this._cursor.advance();
    }
    this._endToken([this._cursor.getChars(start)]);
  }
  /**
   * @returns whether an ICU token has been created
   * @internal
   */
  _tokenizeExpansionForm() {
    if (this.isExpansionFormStart()) {
      this._consumeExpansionFormStart();
      return true;
    }
    if (isExpansionCaseStart(this._cursor.peek()) && this._isInExpansionForm()) {
      this._consumeExpansionCaseStart();
      return true;
    }
    if (this._cursor.peek() === $RBRACE) {
      if (this._isInExpansionCase()) {
        this._consumeExpansionCaseEnd();
        return true;
      }
      if (this._isInExpansionForm()) {
        this._consumeExpansionFormEnd();
        return true;
      }
    }
    return false;
  }
  _beginToken(type, start = this._cursor.clone()) {
    this._currentTokenStart = start;
    this._currentTokenType = type;
  }
  _endToken(parts, end) {
    if (this._currentTokenStart === null) {
      throw new TokenError("Programming error - attempted to end a token when there was no start to the token", this._currentTokenType, this._cursor.getSpan(end));
    }
    if (this._currentTokenType === null) {
      throw new TokenError("Programming error - attempted to end a token which has no token type", null, this._cursor.getSpan(this._currentTokenStart));
    }
    const token = {
      type: this._currentTokenType,
      parts,
      sourceSpan: (end ?? this._cursor).getSpan(this._currentTokenStart, this._leadingTriviaCodePoints)
    };
    this.tokens.push(token);
    this._currentTokenStart = null;
    this._currentTokenType = null;
    return token;
  }
  _createError(msg, span) {
    if (this._isInExpansionForm()) {
      msg += ` (Do you have an unescaped "{" in your template? Use "{{ '{' }}") to escape it.)`;
    }
    const error2 = new TokenError(msg, this._currentTokenType, span);
    this._currentTokenStart = null;
    this._currentTokenType = null;
    return new _ControlFlowError(error2);
  }
  handleError(e) {
    if (e instanceof CursorError) {
      e = this._createError(e.msg, this._cursor.getSpan(e.cursor));
    }
    if (e instanceof _ControlFlowError) {
      this.errors.push(e.error);
    } else {
      throw e;
    }
  }
  _attemptCharCode(charCode) {
    if (this._cursor.peek() === charCode) {
      this._cursor.advance();
      return true;
    }
    return false;
  }
  _attemptCharCodeCaseInsensitive(charCode) {
    if (compareCharCodeCaseInsensitive(this._cursor.peek(), charCode)) {
      this._cursor.advance();
      return true;
    }
    return false;
  }
  _requireCharCode(charCode) {
    const location = this._cursor.clone();
    if (!this._attemptCharCode(charCode)) {
      throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(location));
    }
  }
  _attemptStr(chars) {
    const len = chars.length;
    if (this._cursor.charsLeft() < len) {
      return false;
    }
    const initialPosition = this._cursor.clone();
    for (let i = 0; i < len; i++) {
      if (!this._attemptCharCode(chars.charCodeAt(i))) {
        this._cursor = initialPosition;
        return false;
      }
    }
    return true;
  }
  _attemptStrCaseInsensitive(chars) {
    for (let i = 0; i < chars.length; i++) {
      if (!this._attemptCharCodeCaseInsensitive(chars.charCodeAt(i))) {
        return false;
      }
    }
    return true;
  }
  _requireStr(chars) {
    const location = this._cursor.clone();
    if (!this._attemptStr(chars)) {
      throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(location));
    }
  }
  _attemptCharCodeUntilFn(predicate) {
    while (!predicate(this._cursor.peek())) {
      this._cursor.advance();
    }
  }
  _requireCharCodeUntilFn(predicate, len) {
    const start = this._cursor.clone();
    this._attemptCharCodeUntilFn(predicate);
    if (this._cursor.diff(start) < len) {
      throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(start));
    }
  }
  _attemptUntilChar(char) {
    while (this._cursor.peek() !== char) {
      this._cursor.advance();
    }
  }
  _readChar() {
    const char = String.fromCodePoint(this._cursor.peek());
    this._cursor.advance();
    return char;
  }
  _consumeEntity(textTokenType) {
    this._beginToken(
      9
      /* TokenType.ENCODED_ENTITY */
    );
    const start = this._cursor.clone();
    this._cursor.advance();
    if (this._attemptCharCode($HASH)) {
      const isHex = this._attemptCharCode($x) || this._attemptCharCode($X);
      const codeStart = this._cursor.clone();
      this._attemptCharCodeUntilFn(isDigitEntityEnd);
      if (this._cursor.peek() != $SEMICOLON) {
        this._cursor.advance();
        const entityType = isHex ? CharacterReferenceType.HEX : CharacterReferenceType.DEC;
        throw this._createError(_unparsableEntityErrorMsg(entityType, this._cursor.getChars(start)), this._cursor.getSpan());
      }
      const strNum = this._cursor.getChars(codeStart);
      this._cursor.advance();
      try {
        const charCode = parseInt(strNum, isHex ? 16 : 10);
        this._endToken([String.fromCharCode(charCode), this._cursor.getChars(start)]);
      } catch {
        throw this._createError(_unknownEntityErrorMsg(this._cursor.getChars(start)), this._cursor.getSpan());
      }
    } else {
      const nameStart = this._cursor.clone();
      this._attemptCharCodeUntilFn(isNamedEntityEnd);
      if (this._cursor.peek() != $SEMICOLON) {
        this._beginToken(textTokenType, start);
        this._cursor = nameStart;
        this._endToken(["&"]);
      } else {
        const name = this._cursor.getChars(nameStart);
        this._cursor.advance();
        const char = NAMED_ENTITIES[name];
        if (!char) {
          throw this._createError(_unknownEntityErrorMsg(name), this._cursor.getSpan(start));
        }
        this._endToken([char, `&${name};`]);
      }
    }
  }
  _consumeRawText(consumeEntities, endMarkerPredicate) {
    this._beginToken(
      consumeEntities ? 6 : 7
      /* TokenType.RAW_TEXT */
    );
    const parts = [];
    while (true) {
      const tagCloseStart = this._cursor.clone();
      const foundEndMarker = endMarkerPredicate();
      this._cursor = tagCloseStart;
      if (foundEndMarker) {
        break;
      }
      if (consumeEntities && this._cursor.peek() === $AMPERSAND) {
        this._endToken([this._processCarriageReturns(parts.join(""))]);
        parts.length = 0;
        this._consumeEntity(
          6
          /* TokenType.ESCAPABLE_RAW_TEXT */
        );
        this._beginToken(
          6
          /* TokenType.ESCAPABLE_RAW_TEXT */
        );
      } else {
        parts.push(this._readChar());
      }
    }
    this._endToken([this._processCarriageReturns(parts.join(""))]);
  }
  _consumeComment(start) {
    this._beginToken(10, start);
    this._requireCharCode($MINUS);
    this._endToken([]);
    this._consumeRawText(false, () => this._attemptStr("-->"));
    this._beginToken(
      11
      /* TokenType.COMMENT_END */
    );
    this._requireStr("-->");
    this._endToken([]);
  }
  _consumeCdata(start) {
    this._beginToken(12, start);
    this._requireStr("CDATA[");
    this._endToken([]);
    this._consumeRawText(false, () => this._attemptStr("]]>"));
    this._beginToken(
      13
      /* TokenType.CDATA_END */
    );
    this._requireStr("]]>");
    this._endToken([]);
  }
  _consumeDocType(start) {
    this._beginToken(18, start);
    const contentStart = this._cursor.clone();
    this._attemptUntilChar($GT);
    const content = this._cursor.getChars(contentStart);
    this._cursor.advance();
    this._endToken([content]);
  }
  _consumePrefixAndName() {
    const nameOrPrefixStart = this._cursor.clone();
    let prefix = "";
    while (this._cursor.peek() !== $COLON && !isPrefixEnd(this._cursor.peek())) {
      this._cursor.advance();
    }
    let nameStart;
    if (this._cursor.peek() === $COLON) {
      prefix = this._cursor.getChars(nameOrPrefixStart);
      this._cursor.advance();
      nameStart = this._cursor.clone();
    } else {
      nameStart = nameOrPrefixStart;
    }
    this._requireCharCodeUntilFn(isNameEnd, prefix === "" ? 0 : 1);
    const name = this._cursor.getChars(nameStart);
    return [prefix, name];
  }
  _consumeTagOpen(start) {
    let tagName;
    let prefix;
    let openTagToken;
    try {
      if (!isAsciiLetter(this._cursor.peek())) {
        throw this._createError(_unexpectedCharacterErrorMsg(this._cursor.peek()), this._cursor.getSpan(start));
      }
      openTagToken = this._consumeTagOpenStart(start);
      prefix = openTagToken.parts[0];
      tagName = openTagToken.parts[1];
      this._attemptCharCodeUntilFn(isNotWhitespace);
      while (this._cursor.peek() !== $SLASH && this._cursor.peek() !== $GT && this._cursor.peek() !== $LT && this._cursor.peek() !== $EOF) {
        this._consumeAttributeName();
        this._attemptCharCodeUntilFn(isNotWhitespace);
        if (this._attemptCharCode($EQ)) {
          this._attemptCharCodeUntilFn(isNotWhitespace);
          this._consumeAttributeValue();
        }
        this._attemptCharCodeUntilFn(isNotWhitespace);
      }
      this._consumeTagOpenEnd();
    } catch (e) {
      if (e instanceof _ControlFlowError) {
        if (openTagToken) {
          openTagToken.type = 4;
        } else {
          this._beginToken(5, start);
          this._endToken(["<"]);
        }
        return;
      }
      throw e;
    }
    const contentTokenType = this._getTagDefinition(tagName).getContentType(prefix);
    if (contentTokenType === TagContentType.RAW_TEXT) {
      this._consumeRawTextWithTagClose(prefix, tagName, false);
    } else if (contentTokenType === TagContentType.ESCAPABLE_RAW_TEXT) {
      this._consumeRawTextWithTagClose(prefix, tagName, true);
    }
  }
  _consumeRawTextWithTagClose(prefix, tagName, consumeEntities) {
    this._consumeRawText(consumeEntities, () => {
      if (!this._attemptCharCode($LT))
        return false;
      if (!this._attemptCharCode($SLASH))
        return false;
      this._attemptCharCodeUntilFn(isNotWhitespace);
      if (!this._attemptStrCaseInsensitive(tagName))
        return false;
      this._attemptCharCodeUntilFn(isNotWhitespace);
      return this._attemptCharCode($GT);
    });
    this._beginToken(
      3
      /* TokenType.TAG_CLOSE */
    );
    this._requireCharCodeUntilFn((code) => code === $GT, 3);
    this._cursor.advance();
    this._endToken([prefix, tagName]);
  }
  _consumeTagOpenStart(start) {
    this._beginToken(0, start);
    const parts = this._consumePrefixAndName();
    return this._endToken(parts);
  }
  _consumeAttributeName() {
    const attrNameStart = this._cursor.peek();
    if (attrNameStart === $SQ || attrNameStart === $DQ) {
      throw this._createError(_unexpectedCharacterErrorMsg(attrNameStart), this._cursor.getSpan());
    }
    this._beginToken(
      14
      /* TokenType.ATTR_NAME */
    );
    const prefixAndName = this._consumePrefixAndName();
    this._endToken(prefixAndName);
  }
  _consumeAttributeValue() {
    if (this._cursor.peek() === $SQ || this._cursor.peek() === $DQ) {
      const quoteChar = this._cursor.peek();
      this._consumeQuote(quoteChar);
      const endPredicate = () => this._cursor.peek() === quoteChar;
      this._consumeWithInterpolation(16, 17, endPredicate, endPredicate);
      this._consumeQuote(quoteChar);
    } else {
      const endPredicate = () => isNameEnd(this._cursor.peek());
      this._consumeWithInterpolation(16, 17, endPredicate, endPredicate);
    }
  }
  _consumeQuote(quoteChar) {
    this._beginToken(
      15
      /* TokenType.ATTR_QUOTE */
    );
    this._requireCharCode(quoteChar);
    this._endToken([String.fromCodePoint(quoteChar)]);
  }
  _consumeTagOpenEnd() {
    const tokenType = this._attemptCharCode($SLASH) ? 2 : 1;
    this._beginToken(tokenType);
    this._requireCharCode($GT);
    this._endToken([]);
  }
  _consumeTagClose(start) {
    this._beginToken(3, start);
    this._attemptCharCodeUntilFn(isNotWhitespace);
    const prefixAndName = this._consumePrefixAndName();
    this._attemptCharCodeUntilFn(isNotWhitespace);
    this._requireCharCode($GT);
    this._endToken(prefixAndName);
  }
  _consumeExpansionFormStart() {
    this._beginToken(
      19
      /* TokenType.EXPANSION_FORM_START */
    );
    this._requireCharCode($LBRACE);
    this._endToken([]);
    this._expansionCaseStack.push(
      19
      /* TokenType.EXPANSION_FORM_START */
    );
    this._beginToken(
      7
      /* TokenType.RAW_TEXT */
    );
    const condition = this._readUntil($COMMA);
    const normalizedCondition = this._processCarriageReturns(condition);
    if (this._i18nNormalizeLineEndingsInICUs) {
      this._endToken([normalizedCondition]);
    } else {
      const conditionToken = this._endToken([condition]);
      if (normalizedCondition !== condition) {
        this.nonNormalizedIcuExpressions.push(conditionToken);
      }
    }
    this._requireCharCode($COMMA);
    this._attemptCharCodeUntilFn(isNotWhitespace);
    this._beginToken(
      7
      /* TokenType.RAW_TEXT */
    );
    const type = this._readUntil($COMMA);
    this._endToken([type]);
    this._requireCharCode($COMMA);
    this._attemptCharCodeUntilFn(isNotWhitespace);
  }
  _consumeExpansionCaseStart() {
    this._beginToken(
      20
      /* TokenType.EXPANSION_CASE_VALUE */
    );
    const value = this._readUntil($LBRACE).trim();
    this._endToken([value]);
    this._attemptCharCodeUntilFn(isNotWhitespace);
    this._beginToken(
      21
      /* TokenType.EXPANSION_CASE_EXP_START */
    );
    this._requireCharCode($LBRACE);
    this._endToken([]);
    this._attemptCharCodeUntilFn(isNotWhitespace);
    this._expansionCaseStack.push(
      21
      /* TokenType.EXPANSION_CASE_EXP_START */
    );
  }
  _consumeExpansionCaseEnd() {
    this._beginToken(
      22
      /* TokenType.EXPANSION_CASE_EXP_END */
    );
    this._requireCharCode($RBRACE);
    this._endToken([]);
    this._attemptCharCodeUntilFn(isNotWhitespace);
    this._expansionCaseStack.pop();
  }
  _consumeExpansionFormEnd() {
    this._beginToken(
      23
      /* TokenType.EXPANSION_FORM_END */
    );
    this._requireCharCode($RBRACE);
    this._endToken([]);
    this._expansionCaseStack.pop();
  }
  /**
   * Consume a string that may contain interpolation expressions.
   *
   * The first token consumed will be of `tokenType` and then there will be alternating
   * `interpolationTokenType` and `tokenType` tokens until the `endPredicate()` returns true.
   *
   * If an interpolation token ends prematurely it will have no end marker in its `parts` array.
   *
   * @param textTokenType the kind of tokens to interleave around interpolation tokens.
   * @param interpolationTokenType the kind of tokens that contain interpolation.
   * @param endPredicate a function that should return true when we should stop consuming.
   * @param endInterpolation a function that should return true if there is a premature end to an
   *     interpolation expression - i.e. before we get to the normal interpolation closing marker.
   */
  _consumeWithInterpolation(textTokenType, interpolationTokenType, endPredicate, endInterpolation) {
    this._beginToken(textTokenType);
    const parts = [];
    while (!endPredicate()) {
      const current = this._cursor.clone();
      if (this._interpolationConfig && this._attemptStr(this._interpolationConfig.start)) {
        this._endToken([this._processCarriageReturns(parts.join(""))], current);
        parts.length = 0;
        this._consumeInterpolation(interpolationTokenType, current, endInterpolation);
        this._beginToken(textTokenType);
      } else if (this._cursor.peek() === $AMPERSAND) {
        this._endToken([this._processCarriageReturns(parts.join(""))]);
        parts.length = 0;
        this._consumeEntity(textTokenType);
        this._beginToken(textTokenType);
      } else {
        parts.push(this._readChar());
      }
    }
    this._inInterpolation = false;
    this._endToken([this._processCarriageReturns(parts.join(""))]);
  }
  /**
   * Consume a block of text that has been interpreted as an Angular interpolation.
   *
   * @param interpolationTokenType the type of the interpolation token to generate.
   * @param interpolationStart a cursor that points to the start of this interpolation.
   * @param prematureEndPredicate a function that should return true if the next characters indicate
   *     an end to the interpolation before its normal closing marker.
   */
  _consumeInterpolation(interpolationTokenType, interpolationStart, prematureEndPredicate) {
    const parts = [];
    this._beginToken(interpolationTokenType, interpolationStart);
    parts.push(this._interpolationConfig.start);
    const expressionStart = this._cursor.clone();
    let inQuote = null;
    let inComment = false;
    while (this._cursor.peek() !== $EOF && (prematureEndPredicate === null || !prematureEndPredicate())) {
      const current = this._cursor.clone();
      if (this._isTagStart()) {
        this._cursor = current;
        parts.push(this._getProcessedChars(expressionStart, current));
        this._endToken(parts);
        return;
      }
      if (inQuote === null) {
        if (this._attemptStr(this._interpolationConfig.end)) {
          parts.push(this._getProcessedChars(expressionStart, current));
          parts.push(this._interpolationConfig.end);
          this._endToken(parts);
          return;
        } else if (this._attemptStr("//")) {
          inComment = true;
        }
      }
      const char = this._cursor.peek();
      this._cursor.advance();
      if (char === $BACKSLASH) {
        this._cursor.advance();
      } else if (char === inQuote) {
        inQuote = null;
      } else if (!inComment && inQuote === null && isQuote(char)) {
        inQuote = char;
      }
    }
    parts.push(this._getProcessedChars(expressionStart, this._cursor));
    this._endToken(parts);
  }
  _getProcessedChars(start, end) {
    return this._processCarriageReturns(end.getChars(start));
  }
  _isTextEnd() {
    if (this._isTagStart() || this._cursor.peek() === $EOF) {
      return true;
    }
    if (this._tokenizeIcu && !this._inInterpolation) {
      if (this.isExpansionFormStart()) {
        return true;
      }
      if (this._cursor.peek() === $RBRACE && this._isInExpansionCase()) {
        return true;
      }
    }
    if (this._tokenizeBlocks && !this._inInterpolation && !this._isInExpansion() && (this._cursor.peek() === $AT || this._cursor.peek() === $RBRACE)) {
      return true;
    }
    return false;
  }
  /**
   * Returns true if the current cursor is pointing to the start of a tag
   * (opening/closing/comments/cdata/etc).
   */
  _isTagStart() {
    if (this._cursor.peek() === $LT) {
      const tmp = this._cursor.clone();
      tmp.advance();
      const code = tmp.peek();
      if ($a <= code && code <= $z || $A <= code && code <= $Z || code === $SLASH || code === $BANG) {
        return true;
      }
    }
    return false;
  }
  _readUntil(char) {
    const start = this._cursor.clone();
    this._attemptUntilChar(char);
    return this._cursor.getChars(start);
  }
  _isInExpansion() {
    return this._isInExpansionCase() || this._isInExpansionForm();
  }
  _isInExpansionCase() {
    return this._expansionCaseStack.length > 0 && this._expansionCaseStack[this._expansionCaseStack.length - 1] === 21;
  }
  _isInExpansionForm() {
    return this._expansionCaseStack.length > 0 && this._expansionCaseStack[this._expansionCaseStack.length - 1] === 19;
  }
  isExpansionFormStart() {
    if (this._cursor.peek() !== $LBRACE) {
      return false;
    }
    if (this._interpolationConfig) {
      const start = this._cursor.clone();
      const isInterpolation = this._attemptStr(this._interpolationConfig.start);
      this._cursor = start;
      return !isInterpolation;
    }
    return true;
  }
}
function isNotWhitespace(code) {
  return !isWhitespace(code) || code === $EOF;
}
function isNameEnd(code) {
  return isWhitespace(code) || code === $GT || code === $LT || code === $SLASH || code === $SQ || code === $DQ || code === $EQ || code === $EOF;
}
function isPrefixEnd(code) {
  return (code < $a || $z < code) && (code < $A || $Z < code) && (code < $0 || code > $9);
}
function isDigitEntityEnd(code) {
  return code === $SEMICOLON || code === $EOF || !isAsciiHexDigit(code);
}
function isNamedEntityEnd(code) {
  return code === $SEMICOLON || code === $EOF || !isAsciiLetter(code);
}
function isExpansionCaseStart(peek) {
  return peek !== $RBRACE;
}
function compareCharCodeCaseInsensitive(code1, code2) {
  return toUpperCaseCharCode(code1) === toUpperCaseCharCode(code2);
}
function toUpperCaseCharCode(code) {
  return code >= $a && code <= $z ? code - $a + $A : code;
}
function isBlockNameChar(code) {
  return isAsciiLetter(code) || isDigit(code) || code === $_;
}
function isBlockParameterChar(code) {
  return code !== $SEMICOLON && isNotWhitespace(code);
}
function mergeTextTokens(srcTokens) {
  const dstTokens = [];
  let lastDstToken = void 0;
  for (let i = 0; i < srcTokens.length; i++) {
    const token = srcTokens[i];
    if (lastDstToken && lastDstToken.type === 5 && token.type === 5 || lastDstToken && lastDstToken.type === 16 && token.type === 16) {
      lastDstToken.parts[0] += token.parts[0];
      lastDstToken.sourceSpan.end = token.sourceSpan.end;
    } else {
      lastDstToken = token;
      dstTokens.push(lastDstToken);
    }
  }
  return dstTokens;
}
class PlainCharacterCursor {
  state;
  file;
  input;
  end;
  constructor(fileOrCursor, range) {
    if (fileOrCursor instanceof PlainCharacterCursor) {
      this.file = fileOrCursor.file;
      this.input = fileOrCursor.input;
      this.end = fileOrCursor.end;
      const state = fileOrCursor.state;
      this.state = {
        peek: state.peek,
        offset: state.offset,
        line: state.line,
        column: state.column
      };
    } else {
      if (!range) {
        throw new Error("Programming error: the range argument must be provided with a file argument.");
      }
      this.file = fileOrCursor;
      this.input = fileOrCursor.content;
      this.end = range.endPos;
      this.state = {
        peek: -1,
        offset: range.startPos,
        line: range.startLine,
        column: range.startCol
      };
    }
  }
  clone() {
    return new PlainCharacterCursor(this);
  }
  peek() {
    return this.state.peek;
  }
  charsLeft() {
    return this.end - this.state.offset;
  }
  diff(other) {
    return this.state.offset - other.state.offset;
  }
  advance() {
    this.advanceState(this.state);
  }
  init() {
    this.updatePeek(this.state);
  }
  getSpan(start, leadingTriviaCodePoints) {
    start = start || this;
    let fullStart = start;
    if (leadingTriviaCodePoints) {
      while (this.diff(start) > 0 && leadingTriviaCodePoints.indexOf(start.peek()) !== -1) {
        if (fullStart === start) {
          start = start.clone();
        }
        start.advance();
      }
    }
    const startLocation = this.locationFromCursor(start);
    const endLocation = this.locationFromCursor(this);
    const fullStartLocation = fullStart !== start ? this.locationFromCursor(fullStart) : startLocation;
    return new ParseSourceSpan(startLocation, endLocation, fullStartLocation);
  }
  getChars(start) {
    return this.input.substring(start.state.offset, this.state.offset);
  }
  charAt(pos) {
    return this.input.charCodeAt(pos);
  }
  advanceState(state) {
    if (state.offset >= this.end) {
      this.state = state;
      throw new CursorError('Unexpected character "EOF"', this);
    }
    const currentChar = this.charAt(state.offset);
    if (currentChar === $LF) {
      state.line++;
      state.column = 0;
    } else if (!isNewLine(currentChar)) {
      state.column++;
    }
    state.offset++;
    this.updatePeek(state);
  }
  updatePeek(state) {
    state.peek = state.offset >= this.end ? $EOF : this.charAt(state.offset);
  }
  locationFromCursor(cursor) {
    return new ParseLocation(cursor.file, cursor.state.offset, cursor.state.line, cursor.state.column);
  }
}
class EscapedCharacterCursor extends PlainCharacterCursor {
  internalState;
  constructor(fileOrCursor, range) {
    if (fileOrCursor instanceof EscapedCharacterCursor) {
      super(fileOrCursor);
      this.internalState = { ...fileOrCursor.internalState };
    } else {
      super(fileOrCursor, range);
      this.internalState = this.state;
    }
  }
  advance() {
    this.state = this.internalState;
    super.advance();
    this.processEscapeSequence();
  }
  init() {
    super.init();
    this.processEscapeSequence();
  }
  clone() {
    return new EscapedCharacterCursor(this);
  }
  getChars(start) {
    const cursor = start.clone();
    let chars = "";
    while (cursor.internalState.offset < this.internalState.offset) {
      chars += String.fromCodePoint(cursor.peek());
      cursor.advance();
    }
    return chars;
  }
  /**
   * Process the escape sequence that starts at the current position in the text.
   *
   * This method is called to ensure that `peek` has the unescaped value of escape sequences.
   */
  processEscapeSequence() {
    const peek = () => this.internalState.peek;
    if (peek() === $BACKSLASH) {
      this.internalState = { ...this.state };
      this.advanceState(this.internalState);
      if (peek() === $n) {
        this.state.peek = $LF;
      } else if (peek() === $r) {
        this.state.peek = $CR;
      } else if (peek() === $v) {
        this.state.peek = $VTAB;
      } else if (peek() === $t) {
        this.state.peek = $TAB;
      } else if (peek() === $b) {
        this.state.peek = $BSPACE;
      } else if (peek() === $f) {
        this.state.peek = $FF;
      } else if (peek() === $u) {
        this.advanceState(this.internalState);
        if (peek() === $LBRACE) {
          this.advanceState(this.internalState);
          const digitStart = this.clone();
          let length = 0;
          while (peek() !== $RBRACE) {
            this.advanceState(this.internalState);
            length++;
          }
          this.state.peek = this.decodeHexDigits(digitStart, length);
        } else {
          const digitStart = this.clone();
          this.advanceState(this.internalState);
          this.advanceState(this.internalState);
          this.advanceState(this.internalState);
          this.state.peek = this.decodeHexDigits(digitStart, 4);
        }
      } else if (peek() === $x) {
        this.advanceState(this.internalState);
        const digitStart = this.clone();
        this.advanceState(this.internalState);
        this.state.peek = this.decodeHexDigits(digitStart, 2);
      } else if (isOctalDigit(peek())) {
        let octal = "";
        let length = 0;
        let previous = this.clone();
        while (isOctalDigit(peek()) && length < 3) {
          previous = this.clone();
          octal += String.fromCodePoint(peek());
          this.advanceState(this.internalState);
          length++;
        }
        this.state.peek = parseInt(octal, 8);
        this.internalState = previous.internalState;
      } else if (isNewLine(this.internalState.peek)) {
        this.advanceState(this.internalState);
        this.state = this.internalState;
      } else {
        this.state.peek = this.internalState.peek;
      }
    }
  }
  decodeHexDigits(start, length) {
    const hex = this.input.slice(start.internalState.offset, start.internalState.offset + length);
    const charCode = parseInt(hex, 16);
    if (!isNaN(charCode)) {
      return charCode;
    } else {
      start.state = start.internalState;
      throw new CursorError("Invalid hexadecimal escape sequence", start);
    }
  }
}
class CursorError {
  msg;
  cursor;
  constructor(msg, cursor) {
    this.msg = msg;
    this.cursor = cursor;
  }
}
class TreeError extends ParseError {
  elementName;
  static create(elementName, span, msg) {
    return new TreeError(elementName, span, msg);
  }
  constructor(elementName, span, msg) {
    super(span, msg);
    this.elementName = elementName;
  }
}
class ParseTreeResult {
  rootNodes;
  errors;
  constructor(rootNodes, errors) {
    this.rootNodes = rootNodes;
    this.errors = errors;
  }
}
class Parser$1 {
  getTagDefinition;
  constructor(getTagDefinition) {
    this.getTagDefinition = getTagDefinition;
  }
  parse(source, url, options) {
    const tokenizeResult = tokenize(source, url, this.getTagDefinition, options);
    const parser = new _TreeBuilder(tokenizeResult.tokens, this.getTagDefinition);
    parser.build();
    return new ParseTreeResult(parser.rootNodes, tokenizeResult.errors.concat(parser.errors));
  }
}
class _TreeBuilder {
  tokens;
  getTagDefinition;
  _index = -1;
  // `_peek` will be initialized by the call to `_advance()` in the constructor.
  _peek;
  _containerStack = [];
  rootNodes = [];
  errors = [];
  constructor(tokens, getTagDefinition) {
    this.tokens = tokens;
    this.getTagDefinition = getTagDefinition;
    this._advance();
  }
  build() {
    while (this._peek.type !== 33) {
      if (this._peek.type === 0 || this._peek.type === 4) {
        this._consumeStartTag(this._advance());
      } else if (this._peek.type === 3) {
        this._consumeEndTag(this._advance());
      } else if (this._peek.type === 12) {
        this._closeVoidElement();
        this._consumeCdata(this._advance());
      } else if (this._peek.type === 10) {
        this._closeVoidElement();
        this._consumeComment(this._advance());
      } else if (this._peek.type === 5 || this._peek.type === 7 || this._peek.type === 6) {
        this._closeVoidElement();
        this._consumeText(this._advance());
      } else if (this._peek.type === 19) {
        this._consumeExpansion(this._advance());
      } else if (this._peek.type === 24) {
        this._closeVoidElement();
        this._consumeBlockOpen(this._advance());
      } else if (this._peek.type === 26) {
        this._closeVoidElement();
        this._consumeBlockClose(this._advance());
      } else if (this._peek.type === 28) {
        this._closeVoidElement();
        this._consumeIncompleteBlock(this._advance());
      } else if (this._peek.type === 29) {
        this._closeVoidElement();
        this._consumeLet(this._advance());
      } else if (this._peek.type === 32) {
        this._closeVoidElement();
        this._consumeIncompleteLet(this._advance());
      } else {
        this._advance();
      }
    }
    for (const leftoverContainer of this._containerStack) {
      if (leftoverContainer instanceof Block) {
        this.errors.push(TreeError.create(leftoverContainer.name, leftoverContainer.sourceSpan, `Unclosed block "${leftoverContainer.name}"`));
      }
    }
  }
  _advance() {
    const prev = this._peek;
    if (this._index < this.tokens.length - 1) {
      this._index++;
    }
    this._peek = this.tokens[this._index];
    return prev;
  }
  _advanceIf(type) {
    if (this._peek.type === type) {
      return this._advance();
    }
    return null;
  }
  _consumeCdata(_startToken) {
    this._consumeText(this._advance());
    this._advanceIf(
      13
      /* TokenType.CDATA_END */
    );
  }
  _consumeComment(token) {
    const text2 = this._advanceIf(
      7
      /* TokenType.RAW_TEXT */
    );
    const endToken = this._advanceIf(
      11
      /* TokenType.COMMENT_END */
    );
    const value = text2 != null ? text2.parts[0].trim() : null;
    const sourceSpan = endToken == null ? token.sourceSpan : new ParseSourceSpan(token.sourceSpan.start, endToken.sourceSpan.end, token.sourceSpan.fullStart);
    this._addToParent(new Comment(value, sourceSpan));
  }
  _consumeExpansion(token) {
    const switchValue = this._advance();
    const type = this._advance();
    const cases = [];
    while (this._peek.type === 20) {
      const expCase = this._parseExpansionCase();
      if (!expCase)
        return;
      cases.push(expCase);
    }
    if (this._peek.type !== 23) {
      this.errors.push(TreeError.create(null, this._peek.sourceSpan, `Invalid ICU message. Missing '}'.`));
      return;
    }
    const sourceSpan = new ParseSourceSpan(token.sourceSpan.start, this._peek.sourceSpan.end, token.sourceSpan.fullStart);
    this._addToParent(new Expansion(switchValue.parts[0], type.parts[0], cases, sourceSpan, switchValue.sourceSpan));
    this._advance();
  }
  _parseExpansionCase() {
    const value = this._advance();
    if (this._peek.type !== 21) {
      this.errors.push(TreeError.create(null, this._peek.sourceSpan, `Invalid ICU message. Missing '{'.`));
      return null;
    }
    const start = this._advance();
    const exp = this._collectExpansionExpTokens(start);
    if (!exp)
      return null;
    const end = this._advance();
    exp.push({ type: 33, parts: [], sourceSpan: end.sourceSpan });
    const expansionCaseParser = new _TreeBuilder(exp, this.getTagDefinition);
    expansionCaseParser.build();
    if (expansionCaseParser.errors.length > 0) {
      this.errors = this.errors.concat(expansionCaseParser.errors);
      return null;
    }
    const sourceSpan = new ParseSourceSpan(value.sourceSpan.start, end.sourceSpan.end, value.sourceSpan.fullStart);
    const expSourceSpan = new ParseSourceSpan(start.sourceSpan.start, end.sourceSpan.end, start.sourceSpan.fullStart);
    return new ExpansionCase(value.parts[0], expansionCaseParser.rootNodes, sourceSpan, value.sourceSpan, expSourceSpan);
  }
  _collectExpansionExpTokens(start) {
    const exp = [];
    const expansionFormStack = [
      21
      /* TokenType.EXPANSION_CASE_EXP_START */
    ];
    while (true) {
      if (this._peek.type === 19 || this._peek.type === 21) {
        expansionFormStack.push(this._peek.type);
      }
      if (this._peek.type === 22) {
        if (lastOnStack(
          expansionFormStack,
          21
          /* TokenType.EXPANSION_CASE_EXP_START */
        )) {
          expansionFormStack.pop();
          if (expansionFormStack.length === 0)
            return exp;
        } else {
          this.errors.push(TreeError.create(null, start.sourceSpan, `Invalid ICU message. Missing '}'.`));
          return null;
        }
      }
      if (this._peek.type === 23) {
        if (lastOnStack(
          expansionFormStack,
          19
          /* TokenType.EXPANSION_FORM_START */
        )) {
          expansionFormStack.pop();
        } else {
          this.errors.push(TreeError.create(null, start.sourceSpan, `Invalid ICU message. Missing '}'.`));
          return null;
        }
      }
      if (this._peek.type === 33) {
        this.errors.push(TreeError.create(null, start.sourceSpan, `Invalid ICU message. Missing '}'.`));
        return null;
      }
      exp.push(this._advance());
    }
  }
  _consumeText(token) {
    const tokens = [token];
    const startSpan = token.sourceSpan;
    let text2 = token.parts[0];
    if (text2.length > 0 && text2[0] === "\n") {
      const parent = this._getContainer();
      if (parent != null && parent.children.length === 0 && this.getTagDefinition(parent.name).ignoreFirstLf) {
        text2 = text2.substring(1);
        tokens[0] = { type: token.type, sourceSpan: token.sourceSpan, parts: [text2] };
      }
    }
    while (this._peek.type === 8 || this._peek.type === 5 || this._peek.type === 9) {
      token = this._advance();
      tokens.push(token);
      if (token.type === 8) {
        text2 += token.parts.join("").replace(/&([^;]+);/g, decodeEntity);
      } else if (token.type === 9) {
        text2 += token.parts[0];
      } else {
        text2 += token.parts.join("");
      }
    }
    if (text2.length > 0) {
      const endSpan = token.sourceSpan;
      this._addToParent(new Text(text2, new ParseSourceSpan(startSpan.start, endSpan.end, startSpan.fullStart, startSpan.details), tokens));
    }
  }
  _closeVoidElement() {
    const el = this._getContainer();
    if (el instanceof Element && this.getTagDefinition(el.name).isVoid) {
      this._containerStack.pop();
    }
  }
  _consumeStartTag(startTagToken) {
    const [prefix, name] = startTagToken.parts;
    const attrs = [];
    while (this._peek.type === 14) {
      attrs.push(this._consumeAttr(this._advance()));
    }
    const fullName = this._getElementFullName(prefix, name, this._getClosestParentElement());
    let selfClosing = false;
    if (this._peek.type === 2) {
      this._advance();
      selfClosing = true;
      const tagDef = this.getTagDefinition(fullName);
      if (!(tagDef.canSelfClose || getNsPrefix(fullName) !== null || tagDef.isVoid)) {
        this.errors.push(TreeError.create(fullName, startTagToken.sourceSpan, `Only void, custom and foreign elements can be self closed "${startTagToken.parts[1]}"`));
      }
    } else if (this._peek.type === 1) {
      this._advance();
      selfClosing = false;
    }
    const end = this._peek.sourceSpan.fullStart;
    const span = new ParseSourceSpan(startTagToken.sourceSpan.start, end, startTagToken.sourceSpan.fullStart);
    const startSpan = new ParseSourceSpan(startTagToken.sourceSpan.start, end, startTagToken.sourceSpan.fullStart);
    const el = new Element(fullName, attrs, [], span, startSpan, void 0);
    const parentEl = this._getContainer();
    this._pushContainer(el, parentEl instanceof Element && this.getTagDefinition(parentEl.name).isClosedByChild(el.name));
    if (selfClosing) {
      this._popContainer(fullName, Element, span);
    } else if (startTagToken.type === 4) {
      this._popContainer(fullName, Element, null);
      this.errors.push(TreeError.create(fullName, span, `Opening tag "${fullName}" not terminated.`));
    }
  }
  _pushContainer(node, isClosedByChild) {
    if (isClosedByChild) {
      this._containerStack.pop();
    }
    this._addToParent(node);
    this._containerStack.push(node);
  }
  _consumeEndTag(endTagToken) {
    const fullName = this._getElementFullName(endTagToken.parts[0], endTagToken.parts[1], this._getClosestParentElement());
    if (this.getTagDefinition(fullName).isVoid) {
      this.errors.push(TreeError.create(fullName, endTagToken.sourceSpan, `Void elements do not have end tags "${endTagToken.parts[1]}"`));
    } else if (!this._popContainer(fullName, Element, endTagToken.sourceSpan)) {
      const errMsg = `Unexpected closing tag "${fullName}". It may happen when the tag has already been closed by another tag. For more info see https://www.w3.org/TR/html5/syntax.html#closing-elements-that-have-implied-end-tags`;
      this.errors.push(TreeError.create(fullName, endTagToken.sourceSpan, errMsg));
    }
  }
  /**
   * Closes the nearest element with the tag name `fullName` in the parse tree.
   * `endSourceSpan` is the span of the closing tag, or null if the element does
   * not have a closing tag (for example, this happens when an incomplete
   * opening tag is recovered).
   */
  _popContainer(expectedName, expectedType, endSourceSpan) {
    let unexpectedCloseTagDetected = false;
    for (let stackIndex = this._containerStack.length - 1; stackIndex >= 0; stackIndex--) {
      const node = this._containerStack[stackIndex];
      if ((node.name === expectedName || expectedName === null) && node instanceof expectedType) {
        node.endSourceSpan = endSourceSpan;
        node.sourceSpan.end = endSourceSpan !== null ? endSourceSpan.end : node.sourceSpan.end;
        this._containerStack.splice(stackIndex, this._containerStack.length - stackIndex);
        return !unexpectedCloseTagDetected;
      }
      if (node instanceof Block || node instanceof Element && !this.getTagDefinition(node.name).closedByParent) {
        unexpectedCloseTagDetected = true;
      }
    }
    return false;
  }
  _consumeAttr(attrName) {
    const fullName = mergeNsAndName(attrName.parts[0], attrName.parts[1]);
    let attrEnd = attrName.sourceSpan.end;
    if (this._peek.type === 15) {
      this._advance();
    }
    let value = "";
    const valueTokens = [];
    let valueStartSpan = void 0;
    let valueEnd = void 0;
    const nextTokenType = this._peek.type;
    if (nextTokenType === 16) {
      valueStartSpan = this._peek.sourceSpan;
      valueEnd = this._peek.sourceSpan.end;
      while (this._peek.type === 16 || this._peek.type === 17 || this._peek.type === 9) {
        const valueToken = this._advance();
        valueTokens.push(valueToken);
        if (valueToken.type === 17) {
          value += valueToken.parts.join("").replace(/&([^;]+);/g, decodeEntity);
        } else if (valueToken.type === 9) {
          value += valueToken.parts[0];
        } else {
          value += valueToken.parts.join("");
        }
        valueEnd = attrEnd = valueToken.sourceSpan.end;
      }
    }
    if (this._peek.type === 15) {
      const quoteToken = this._advance();
      attrEnd = quoteToken.sourceSpan.end;
    }
    const valueSpan = valueStartSpan && valueEnd && new ParseSourceSpan(valueStartSpan.start, valueEnd, valueStartSpan.fullStart);
    return new Attribute(fullName, value, new ParseSourceSpan(attrName.sourceSpan.start, attrEnd, attrName.sourceSpan.fullStart), attrName.sourceSpan, valueSpan, valueTokens.length > 0 ? valueTokens : void 0, void 0);
  }
  _consumeBlockOpen(token) {
    const parameters = [];
    while (this._peek.type === 27) {
      const paramToken = this._advance();
      parameters.push(new BlockParameter(paramToken.parts[0], paramToken.sourceSpan));
    }
    if (this._peek.type === 25) {
      this._advance();
    }
    const end = this._peek.sourceSpan.fullStart;
    const span = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
    const startSpan = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
    const block = new Block(token.parts[0], parameters, [], span, token.sourceSpan, startSpan);
    this._pushContainer(block, false);
  }
  _consumeBlockClose(token) {
    if (!this._popContainer(null, Block, token.sourceSpan)) {
      this.errors.push(TreeError.create(null, token.sourceSpan, `Unexpected closing block. The block may have been closed earlier. If you meant to write the } character, you should use the "&#125;" HTML entity instead.`));
    }
  }
  _consumeIncompleteBlock(token) {
    const parameters = [];
    while (this._peek.type === 27) {
      const paramToken = this._advance();
      parameters.push(new BlockParameter(paramToken.parts[0], paramToken.sourceSpan));
    }
    const end = this._peek.sourceSpan.fullStart;
    const span = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
    const startSpan = new ParseSourceSpan(token.sourceSpan.start, end, token.sourceSpan.fullStart);
    const block = new Block(token.parts[0], parameters, [], span, token.sourceSpan, startSpan);
    this._pushContainer(block, false);
    this._popContainer(null, Block, null);
    this.errors.push(TreeError.create(token.parts[0], span, `Incomplete block "${token.parts[0]}". If you meant to write the @ character, you should use the "&#64;" HTML entity instead.`));
  }
  _consumeLet(startToken) {
    const name = startToken.parts[0];
    let valueToken;
    let endToken;
    if (this._peek.type !== 30) {
      this.errors.push(TreeError.create(startToken.parts[0], startToken.sourceSpan, `Invalid @let declaration "${name}". Declaration must have a value.`));
      return;
    } else {
      valueToken = this._advance();
    }
    if (this._peek.type !== 31) {
      this.errors.push(TreeError.create(startToken.parts[0], startToken.sourceSpan, `Unterminated @let declaration "${name}". Declaration must be terminated with a semicolon.`));
      return;
    } else {
      endToken = this._advance();
    }
    const end = endToken.sourceSpan.fullStart;
    const span = new ParseSourceSpan(startToken.sourceSpan.start, end, startToken.sourceSpan.fullStart);
    const startOffset = startToken.sourceSpan.toString().lastIndexOf(name);
    const nameStart = startToken.sourceSpan.start.moveBy(startOffset);
    const nameSpan = new ParseSourceSpan(nameStart, startToken.sourceSpan.end);
    const node = new LetDeclaration(name, valueToken.parts[0], span, nameSpan, valueToken.sourceSpan);
    this._addToParent(node);
  }
  _consumeIncompleteLet(token) {
    const name = token.parts[0] ?? "";
    const nameString = name ? ` "${name}"` : "";
    if (name.length > 0) {
      const startOffset = token.sourceSpan.toString().lastIndexOf(name);
      const nameStart = token.sourceSpan.start.moveBy(startOffset);
      const nameSpan = new ParseSourceSpan(nameStart, token.sourceSpan.end);
      const valueSpan = new ParseSourceSpan(token.sourceSpan.start, token.sourceSpan.start.moveBy(0));
      const node = new LetDeclaration(name, "", token.sourceSpan, nameSpan, valueSpan);
      this._addToParent(node);
    }
    this.errors.push(TreeError.create(token.parts[0], token.sourceSpan, `Incomplete @let declaration${nameString}. @let declarations must be written as \`@let <name> = <value>;\``));
  }
  _getContainer() {
    return this._containerStack.length > 0 ? this._containerStack[this._containerStack.length - 1] : null;
  }
  _getClosestParentElement() {
    for (let i = this._containerStack.length - 1; i > -1; i--) {
      if (this._containerStack[i] instanceof Element) {
        return this._containerStack[i];
      }
    }
    return null;
  }
  _addToParent(node) {
    const parent = this._getContainer();
    if (parent === null) {
      this.rootNodes.push(node);
    } else {
      parent.children.push(node);
    }
  }
  _getElementFullName(prefix, localName, parentElement) {
    if (prefix === "") {
      prefix = this.getTagDefinition(localName).implicitNamespacePrefix || "";
      if (prefix === "" && parentElement != null) {
        const parentTagName = splitNsName(parentElement.name)[1];
        const parentTagDefinition = this.getTagDefinition(parentTagName);
        if (!parentTagDefinition.preventNamespaceInheritance) {
          prefix = getNsPrefix(parentElement.name);
        }
      }
    }
    return mergeNsAndName(prefix, localName);
  }
}
function lastOnStack(stack, element2) {
  return stack.length > 0 && stack[stack.length - 1] === element2;
}
function decodeEntity(match, entity) {
  if (NAMED_ENTITIES[entity] !== void 0) {
    return NAMED_ENTITIES[entity] || match;
  }
  if (/^#x[a-f0-9]+$/i.test(entity)) {
    return String.fromCodePoint(parseInt(entity.slice(2), 16));
  }
  if (/^#\d+$/.test(entity)) {
    return String.fromCodePoint(parseInt(entity.slice(1), 10));
  }
  return match;
}
const PRESERVE_WS_ATTR_NAME = "ngPreserveWhitespaces";
const SKIP_WS_TRIM_TAGS = /* @__PURE__ */ new Set(["pre", "template", "textarea", "script", "style"]);
const WS_CHARS = " \f\n\r	\v ᠎ - \u2028\u2029  　\uFEFF";
const NO_WS_REGEXP = new RegExp(`[^${WS_CHARS}]`);
const WS_REPLACE_REGEXP = new RegExp(`[${WS_CHARS}]{2,}`, "g");
function hasPreserveWhitespacesAttr(attrs) {
  return attrs.some((attr) => attr.name === PRESERVE_WS_ATTR_NAME);
}
function replaceNgsp(value) {
  return value.replace(new RegExp(NGSP_UNICODE, "g"), " ");
}
class WhitespaceVisitor {
  preserveSignificantWhitespace;
  originalNodeMap;
  requireContext;
  // How many ICU expansions which are currently being visited. ICUs can be nested, so this
  // tracks the current depth of nesting. If this depth is greater than 0, then this visitor is
  // currently processing content inside an ICU expansion.
  icuExpansionDepth = 0;
  constructor(preserveSignificantWhitespace, originalNodeMap, requireContext = true) {
    this.preserveSignificantWhitespace = preserveSignificantWhitespace;
    this.originalNodeMap = originalNodeMap;
    this.requireContext = requireContext;
  }
  visitElement(element2, context) {
    if (SKIP_WS_TRIM_TAGS.has(element2.name) || hasPreserveWhitespacesAttr(element2.attrs)) {
      const newElement2 = new Element(element2.name, visitAllWithSiblings(this, element2.attrs), element2.children, element2.sourceSpan, element2.startSourceSpan, element2.endSourceSpan, element2.i18n);
      this.originalNodeMap?.set(newElement2, element2);
      return newElement2;
    }
    const newElement = new Element(element2.name, element2.attrs, visitAllWithSiblings(this, element2.children), element2.sourceSpan, element2.startSourceSpan, element2.endSourceSpan, element2.i18n);
    this.originalNodeMap?.set(newElement, element2);
    return newElement;
  }
  visitAttribute(attribute2, context) {
    return attribute2.name !== PRESERVE_WS_ATTR_NAME ? attribute2 : null;
  }
  visitText(text2, context) {
    const isNotBlank = text2.value.match(NO_WS_REGEXP);
    const hasExpansionSibling = context && (context.prev instanceof Expansion || context.next instanceof Expansion);
    const inIcuExpansion = this.icuExpansionDepth > 0;
    if (inIcuExpansion && this.preserveSignificantWhitespace)
      return text2;
    if (isNotBlank || hasExpansionSibling) {
      const tokens = text2.tokens.map((token) => token.type === 5 ? createWhitespaceProcessedTextToken(token) : token);
      if (!this.preserveSignificantWhitespace && tokens.length > 0) {
        const firstToken = tokens[0];
        tokens.splice(0, 1, trimLeadingWhitespace(firstToken, context));
        const lastToken = tokens[tokens.length - 1];
        tokens.splice(tokens.length - 1, 1, trimTrailingWhitespace(lastToken, context));
      }
      const processed = processWhitespace(text2.value);
      const value = this.preserveSignificantWhitespace ? processed : trimLeadingAndTrailingWhitespace(processed, context);
      const result = new Text(value, text2.sourceSpan, tokens, text2.i18n);
      this.originalNodeMap?.set(result, text2);
      return result;
    }
    return null;
  }
  visitComment(comment, context) {
    return comment;
  }
  visitExpansion(expansion, context) {
    this.icuExpansionDepth++;
    let newExpansion;
    try {
      newExpansion = new Expansion(expansion.switchValue, expansion.type, visitAllWithSiblings(this, expansion.cases), expansion.sourceSpan, expansion.switchValueSourceSpan, expansion.i18n);
    } finally {
      this.icuExpansionDepth--;
    }
    this.originalNodeMap?.set(newExpansion, expansion);
    return newExpansion;
  }
  visitExpansionCase(expansionCase, context) {
    const newExpansionCase = new ExpansionCase(expansionCase.value, visitAllWithSiblings(this, expansionCase.expression), expansionCase.sourceSpan, expansionCase.valueSourceSpan, expansionCase.expSourceSpan);
    this.originalNodeMap?.set(newExpansionCase, expansionCase);
    return newExpansionCase;
  }
  visitBlock(block, context) {
    const newBlock = new Block(block.name, block.parameters, visitAllWithSiblings(this, block.children), block.sourceSpan, block.nameSpan, block.startSourceSpan, block.endSourceSpan);
    this.originalNodeMap?.set(newBlock, block);
    return newBlock;
  }
  visitBlockParameter(parameter, context) {
    return parameter;
  }
  visitLetDeclaration(decl, context) {
    return decl;
  }
  visit(_node, context) {
    if (this.requireContext && !context) {
      throw new Error(`WhitespaceVisitor requires context. Visit via \`visitAllWithSiblings\` to get this context.`);
    }
    return false;
  }
}
function trimLeadingWhitespace(token, context) {
  if (token.type !== 5)
    return token;
  const isFirstTokenInTag = !context?.prev;
  if (!isFirstTokenInTag)
    return token;
  return transformTextToken(token, (text2) => text2.trimStart());
}
function trimTrailingWhitespace(token, context) {
  if (token.type !== 5)
    return token;
  const isLastTokenInTag = !context?.next;
  if (!isLastTokenInTag)
    return token;
  return transformTextToken(token, (text2) => text2.trimEnd());
}
function trimLeadingAndTrailingWhitespace(text2, context) {
  const isFirstTokenInTag = !context?.prev;
  const isLastTokenInTag = !context?.next;
  const maybeTrimmedStart = isFirstTokenInTag ? text2.trimStart() : text2;
  const maybeTrimmed = isLastTokenInTag ? maybeTrimmedStart.trimEnd() : maybeTrimmedStart;
  return maybeTrimmed;
}
function createWhitespaceProcessedTextToken({ type, parts, sourceSpan }) {
  return { type, parts: [processWhitespace(parts[0])], sourceSpan };
}
function transformTextToken({ type, parts, sourceSpan }, transform2) {
  return { type, parts: [transform2(parts[0])], sourceSpan };
}
function processWhitespace(text2) {
  return replaceNgsp(text2).replace(WS_REPLACE_REGEXP, " ");
}
function visitAllWithSiblings(visitor, nodes) {
  const result = [];
  nodes.forEach((ast, i) => {
    const context = { prev: nodes[i - 1], next: nodes[i + 1] };
    const astResult = ast.visit(visitor, context);
    if (astResult) {
      result.push(astResult);
    }
  });
  return result;
}
var TokenType;
(function(TokenType2) {
  TokenType2[TokenType2["Character"] = 0] = "Character";
  TokenType2[TokenType2["Identifier"] = 1] = "Identifier";
  TokenType2[TokenType2["PrivateIdentifier"] = 2] = "PrivateIdentifier";
  TokenType2[TokenType2["Keyword"] = 3] = "Keyword";
  TokenType2[TokenType2["String"] = 4] = "String";
  TokenType2[TokenType2["Operator"] = 5] = "Operator";
  TokenType2[TokenType2["Number"] = 6] = "Number";
  TokenType2[TokenType2["Error"] = 7] = "Error";
})(TokenType || (TokenType = {}));
const KEYWORDS = [
  "var",
  "let",
  "as",
  "null",
  "undefined",
  "true",
  "false",
  "if",
  "else",
  "this",
  "typeof"
];
class Lexer {
  tokenize(text2) {
    const scanner = new _Scanner(text2);
    const tokens = [];
    let token = scanner.scanToken();
    while (token != null) {
      tokens.push(token);
      token = scanner.scanToken();
    }
    return tokens;
  }
}
class Token {
  index;
  end;
  type;
  numValue;
  strValue;
  constructor(index, end, type, numValue, strValue) {
    this.index = index;
    this.end = end;
    this.type = type;
    this.numValue = numValue;
    this.strValue = strValue;
  }
  isCharacter(code) {
    return this.type == TokenType.Character && this.numValue == code;
  }
  isNumber() {
    return this.type == TokenType.Number;
  }
  isString() {
    return this.type == TokenType.String;
  }
  isOperator(operator) {
    return this.type == TokenType.Operator && this.strValue == operator;
  }
  isIdentifier() {
    return this.type == TokenType.Identifier;
  }
  isPrivateIdentifier() {
    return this.type == TokenType.PrivateIdentifier;
  }
  isKeyword() {
    return this.type == TokenType.Keyword;
  }
  isKeywordLet() {
    return this.type == TokenType.Keyword && this.strValue == "let";
  }
  isKeywordAs() {
    return this.type == TokenType.Keyword && this.strValue == "as";
  }
  isKeywordNull() {
    return this.type == TokenType.Keyword && this.strValue == "null";
  }
  isKeywordUndefined() {
    return this.type == TokenType.Keyword && this.strValue == "undefined";
  }
  isKeywordTrue() {
    return this.type == TokenType.Keyword && this.strValue == "true";
  }
  isKeywordFalse() {
    return this.type == TokenType.Keyword && this.strValue == "false";
  }
  isKeywordThis() {
    return this.type == TokenType.Keyword && this.strValue == "this";
  }
  isKeywordTypeof() {
    return this.type === TokenType.Keyword && this.strValue === "typeof";
  }
  isError() {
    return this.type == TokenType.Error;
  }
  toNumber() {
    return this.type == TokenType.Number ? this.numValue : -1;
  }
  toString() {
    switch (this.type) {
      case TokenType.Character:
      case TokenType.Identifier:
      case TokenType.Keyword:
      case TokenType.Operator:
      case TokenType.PrivateIdentifier:
      case TokenType.String:
      case TokenType.Error:
        return this.strValue;
      case TokenType.Number:
        return this.numValue.toString();
      default:
        return null;
    }
  }
}
function newCharacterToken(index, end, code) {
  return new Token(index, end, TokenType.Character, code, String.fromCharCode(code));
}
function newIdentifierToken(index, end, text2) {
  return new Token(index, end, TokenType.Identifier, 0, text2);
}
function newPrivateIdentifierToken(index, end, text2) {
  return new Token(index, end, TokenType.PrivateIdentifier, 0, text2);
}
function newKeywordToken(index, end, text2) {
  return new Token(index, end, TokenType.Keyword, 0, text2);
}
function newOperatorToken(index, end, text2) {
  return new Token(index, end, TokenType.Operator, 0, text2);
}
function newStringToken(index, end, text2) {
  return new Token(index, end, TokenType.String, 0, text2);
}
function newNumberToken(index, end, n) {
  return new Token(index, end, TokenType.Number, n, "");
}
function newErrorToken(index, end, message) {
  return new Token(index, end, TokenType.Error, 0, message);
}
const EOF = new Token(-1, -1, TokenType.Character, 0, "");
class _Scanner {
  input;
  length;
  peek = 0;
  index = -1;
  constructor(input) {
    this.input = input;
    this.length = input.length;
    this.advance();
  }
  advance() {
    this.peek = ++this.index >= this.length ? $EOF : this.input.charCodeAt(this.index);
  }
  scanToken() {
    const input = this.input, length = this.length;
    let peek = this.peek, index = this.index;
    while (peek <= $SPACE) {
      if (++index >= length) {
        peek = $EOF;
        break;
      } else {
        peek = input.charCodeAt(index);
      }
    }
    this.peek = peek;
    this.index = index;
    if (index >= length) {
      return null;
    }
    if (isIdentifierStart(peek))
      return this.scanIdentifier();
    if (isDigit(peek))
      return this.scanNumber(index);
    const start = index;
    switch (peek) {
      case $PERIOD:
        this.advance();
        return isDigit(this.peek) ? this.scanNumber(start) : newCharacterToken(start, this.index, $PERIOD);
      case $LPAREN:
      case $RPAREN:
      case $LBRACE:
      case $RBRACE:
      case $LBRACKET:
      case $RBRACKET:
      case $COMMA:
      case $COLON:
      case $SEMICOLON:
        return this.scanCharacter(start, peek);
      case $SQ:
      case $DQ:
        return this.scanString();
      case $HASH:
        return this.scanPrivateIdentifier();
      case $PLUS:
      case $MINUS:
      case $STAR:
      case $SLASH:
      case $PERCENT:
      case $CARET:
        return this.scanOperator(start, String.fromCharCode(peek));
      case $QUESTION:
        return this.scanQuestion(start);
      case $LT:
      case $GT:
        return this.scanComplexOperator(start, String.fromCharCode(peek), $EQ, "=");
      case $BANG:
      case $EQ:
        return this.scanComplexOperator(start, String.fromCharCode(peek), $EQ, "=", $EQ, "=");
      case $AMPERSAND:
        return this.scanComplexOperator(start, "&", $AMPERSAND, "&");
      case $BAR:
        return this.scanComplexOperator(start, "|", $BAR, "|");
      case $NBSP:
        while (isWhitespace(this.peek))
          this.advance();
        return this.scanToken();
    }
    this.advance();
    return this.error(`Unexpected character [${String.fromCharCode(peek)}]`, 0);
  }
  scanCharacter(start, code) {
    this.advance();
    return newCharacterToken(start, this.index, code);
  }
  scanOperator(start, str) {
    this.advance();
    return newOperatorToken(start, this.index, str);
  }
  /**
   * Tokenize a 2/3 char long operator
   *
   * @param start start index in the expression
   * @param one first symbol (always part of the operator)
   * @param twoCode code point for the second symbol
   * @param two second symbol (part of the operator when the second code point matches)
   * @param threeCode code point for the third symbol
   * @param three third symbol (part of the operator when provided and matches source expression)
   */
  scanComplexOperator(start, one, twoCode, two, threeCode, three) {
    this.advance();
    let str = one;
    if (this.peek == twoCode) {
      this.advance();
      str += two;
    }
    if (threeCode != null && this.peek == threeCode) {
      this.advance();
      str += three;
    }
    return newOperatorToken(start, this.index, str);
  }
  scanIdentifier() {
    const start = this.index;
    this.advance();
    while (isIdentifierPart(this.peek))
      this.advance();
    const str = this.input.substring(start, this.index);
    return KEYWORDS.indexOf(str) > -1 ? newKeywordToken(start, this.index, str) : newIdentifierToken(start, this.index, str);
  }
  /** Scans an ECMAScript private identifier. */
  scanPrivateIdentifier() {
    const start = this.index;
    this.advance();
    if (!isIdentifierStart(this.peek)) {
      return this.error("Invalid character [#]", -1);
    }
    while (isIdentifierPart(this.peek))
      this.advance();
    const identifierName2 = this.input.substring(start, this.index);
    return newPrivateIdentifierToken(start, this.index, identifierName2);
  }
  scanNumber(start) {
    let simple = this.index === start;
    let hasSeparators = false;
    this.advance();
    while (true) {
      if (isDigit(this.peek)) ; else if (this.peek === $_) {
        if (!isDigit(this.input.charCodeAt(this.index - 1)) || !isDigit(this.input.charCodeAt(this.index + 1))) {
          return this.error("Invalid numeric separator", 0);
        }
        hasSeparators = true;
      } else if (this.peek === $PERIOD) {
        simple = false;
      } else if (isExponentStart(this.peek)) {
        this.advance();
        if (isExponentSign(this.peek))
          this.advance();
        if (!isDigit(this.peek))
          return this.error("Invalid exponent", -1);
        simple = false;
      } else {
        break;
      }
      this.advance();
    }
    let str = this.input.substring(start, this.index);
    if (hasSeparators) {
      str = str.replace(/_/g, "");
    }
    const value = simple ? parseIntAutoRadix(str) : parseFloat(str);
    return newNumberToken(start, this.index, value);
  }
  scanString() {
    const start = this.index;
    const quote = this.peek;
    this.advance();
    let buffer = "";
    let marker = this.index;
    const input = this.input;
    while (this.peek != quote) {
      if (this.peek == $BACKSLASH) {
        buffer += input.substring(marker, this.index);
        let unescapedCode;
        this.advance();
        if (this.peek == $u) {
          const hex = input.substring(this.index + 1, this.index + 5);
          if (/^[0-9a-f]+$/i.test(hex)) {
            unescapedCode = parseInt(hex, 16);
          } else {
            return this.error(`Invalid unicode escape [\\u${hex}]`, 0);
          }
          for (let i = 0; i < 5; i++) {
            this.advance();
          }
        } else {
          unescapedCode = unescape(this.peek);
          this.advance();
        }
        buffer += String.fromCharCode(unescapedCode);
        marker = this.index;
      } else if (this.peek == $EOF) {
        return this.error("Unterminated quote", 0);
      } else {
        this.advance();
      }
    }
    const last = input.substring(marker, this.index);
    this.advance();
    return newStringToken(start, this.index, buffer + last);
  }
  scanQuestion(start) {
    this.advance();
    let str = "?";
    if (this.peek === $QUESTION || this.peek === $PERIOD) {
      str += this.peek === $PERIOD ? "." : "?";
      this.advance();
    }
    return newOperatorToken(start, this.index, str);
  }
  error(message, offset) {
    const position = this.index + offset;
    return newErrorToken(position, this.index, `Lexer Error: ${message} at column ${position} in expression [${this.input}]`);
  }
}
function isIdentifierStart(code) {
  return $a <= code && code <= $z || $A <= code && code <= $Z || code == $_ || code == $$;
}
function isIdentifierPart(code) {
  return isAsciiLetter(code) || isDigit(code) || code == $_ || code == $$;
}
function isExponentStart(code) {
  return code == $e || code == $E;
}
function isExponentSign(code) {
  return code == $MINUS || code == $PLUS;
}
function unescape(code) {
  switch (code) {
    case $n:
      return $LF;
    case $f:
      return $FF;
    case $r:
      return $CR;
    case $t:
      return $TAB;
    case $v:
      return $VTAB;
    default:
      return code;
  }
}
function parseIntAutoRadix(text2) {
  const result = parseInt(text2);
  if (isNaN(result)) {
    throw new Error("Invalid integer literal when parsing " + text2);
  }
  return result;
}
class SplitInterpolation {
  strings;
  expressions;
  offsets;
  constructor(strings, expressions, offsets) {
    this.strings = strings;
    this.expressions = expressions;
    this.offsets = offsets;
  }
}
class TemplateBindingParseResult {
  templateBindings;
  warnings;
  errors;
  constructor(templateBindings, warnings, errors) {
    this.templateBindings = templateBindings;
    this.warnings = warnings;
    this.errors = errors;
  }
}
class Parser {
  _lexer;
  errors = [];
  constructor(_lexer) {
    this._lexer = _lexer;
  }
  parseAction(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
    this._checkNoInterpolation(input, location, interpolationConfig);
    const sourceToLex = this._stripComments(input);
    const tokens = this._lexer.tokenize(sourceToLex);
    const ast = new _ParseAST(input, location, absoluteOffset, tokens, 1, this.errors, 0).parseChain();
    return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
  }
  parseBinding(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
    const ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
    return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
  }
  checkSimpleExpression(ast) {
    const checker = new SimpleExpressionChecker();
    ast.visit(checker);
    return checker.errors;
  }
  // Host bindings parsed here
  parseSimpleBinding(input, location, absoluteOffset, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
    const ast = this._parseBindingAst(input, location, absoluteOffset, interpolationConfig);
    const errors = this.checkSimpleExpression(ast);
    if (errors.length > 0) {
      this._reportError(`Host binding expression cannot contain ${errors.join(" ")}`, input, location);
    }
    return new ASTWithSource(ast, input, location, absoluteOffset, this.errors);
  }
  _reportError(message, input, errLocation, ctxLocation) {
    this.errors.push(new ParserError(message, input, errLocation, ctxLocation));
  }
  _parseBindingAst(input, location, absoluteOffset, interpolationConfig) {
    this._checkNoInterpolation(input, location, interpolationConfig);
    const sourceToLex = this._stripComments(input);
    const tokens = this._lexer.tokenize(sourceToLex);
    return new _ParseAST(input, location, absoluteOffset, tokens, 0, this.errors, 0).parseChain();
  }
  /**
   * Parse microsyntax template expression and return a list of bindings or
   * parsing errors in case the given expression is invalid.
   *
   * For example,
   * ```
   *   <div *ngFor="let item of items">
   *         ^      ^ absoluteValueOffset for `templateValue`
   *         absoluteKeyOffset for `templateKey`
   * ```
   * contains three bindings:
   * 1. ngFor -> null
   * 2. item -> NgForOfContext.$implicit
   * 3. ngForOf -> items
   *
   * This is apparent from the de-sugared template:
   * ```
   *   <ng-template ngFor let-item [ngForOf]="items">
   * ```
   *
   * @param templateKey name of directive, without the * prefix. For example: ngIf, ngFor
   * @param templateValue RHS of the microsyntax attribute
   * @param templateUrl template filename if it's external, component filename if it's inline
   * @param absoluteKeyOffset start of the `templateKey`
   * @param absoluteValueOffset start of the `templateValue`
   */
  parseTemplateBindings(templateKey, templateValue, templateUrl, absoluteKeyOffset, absoluteValueOffset) {
    const tokens = this._lexer.tokenize(templateValue);
    const parser = new _ParseAST(
      templateValue,
      templateUrl,
      absoluteValueOffset,
      tokens,
      0,
      this.errors,
      0
      /* relative offset */
    );
    return parser.parseTemplateBindings({
      source: templateKey,
      span: new AbsoluteSourceSpan(absoluteKeyOffset, absoluteKeyOffset + templateKey.length)
    });
  }
  parseInterpolation(input, location, absoluteOffset, interpolatedTokens, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
    const { strings, expressions, offsets } = this.splitInterpolation(input, location, interpolatedTokens, interpolationConfig);
    if (expressions.length === 0)
      return null;
    const expressionNodes = [];
    for (let i = 0; i < expressions.length; ++i) {
      const expressionText = expressions[i].text;
      const sourceToLex = this._stripComments(expressionText);
      const tokens = this._lexer.tokenize(sourceToLex);
      const ast = new _ParseAST(input, location, absoluteOffset, tokens, 0, this.errors, offsets[i]).parseChain();
      expressionNodes.push(ast);
    }
    return this.createInterpolationAst(strings.map((s) => s.text), expressionNodes, input, location, absoluteOffset);
  }
  /**
   * Similar to `parseInterpolation`, but treats the provided string as a single expression
   * element that would normally appear within the interpolation prefix and suffix (`{{` and `}}`).
   * This is used for parsing the switch expression in ICUs.
   */
  parseInterpolationExpression(expression, location, absoluteOffset) {
    const sourceToLex = this._stripComments(expression);
    const tokens = this._lexer.tokenize(sourceToLex);
    const ast = new _ParseAST(expression, location, absoluteOffset, tokens, 0, this.errors, 0).parseChain();
    const strings = ["", ""];
    return this.createInterpolationAst(strings, [ast], expression, location, absoluteOffset);
  }
  createInterpolationAst(strings, expressions, input, location, absoluteOffset) {
    const span = new ParseSpan(0, input.length);
    const interpolation = new Interpolation$1(span, span.toAbsolute(absoluteOffset), strings, expressions);
    return new ASTWithSource(interpolation, input, location, absoluteOffset, this.errors);
  }
  /**
   * Splits a string of text into "raw" text segments and expressions present in interpolations in
   * the string.
   * Returns `null` if there are no interpolations, otherwise a
   * `SplitInterpolation` with splits that look like
   *   <raw text> <expression> <raw text> ... <raw text> <expression> <raw text>
   */
  splitInterpolation(input, location, interpolatedTokens, interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
    const strings = [];
    const expressions = [];
    const offsets = [];
    const inputToTemplateIndexMap = interpolatedTokens ? getIndexMapForOriginalTemplate(interpolatedTokens) : null;
    let i = 0;
    let atInterpolation = false;
    let extendLastString = false;
    let { start: interpStart, end: interpEnd } = interpolationConfig;
    while (i < input.length) {
      if (!atInterpolation) {
        const start = i;
        i = input.indexOf(interpStart, i);
        if (i === -1) {
          i = input.length;
        }
        const text2 = input.substring(start, i);
        strings.push({ text: text2, start, end: i });
        atInterpolation = true;
      } else {
        const fullStart = i;
        const exprStart = fullStart + interpStart.length;
        const exprEnd = this._getInterpolationEndIndex(input, interpEnd, exprStart);
        if (exprEnd === -1) {
          atInterpolation = false;
          extendLastString = true;
          break;
        }
        const fullEnd = exprEnd + interpEnd.length;
        const text2 = input.substring(exprStart, exprEnd);
        if (text2.trim().length === 0) {
          this._reportError("Blank expressions are not allowed in interpolated strings", input, `at column ${i} in`, location);
        }
        expressions.push({ text: text2, start: fullStart, end: fullEnd });
        const startInOriginalTemplate = inputToTemplateIndexMap?.get(fullStart) ?? fullStart;
        const offset = startInOriginalTemplate + interpStart.length;
        offsets.push(offset);
        i = fullEnd;
        atInterpolation = false;
      }
    }
    if (!atInterpolation) {
      if (extendLastString) {
        const piece = strings[strings.length - 1];
        piece.text += input.substring(i);
        piece.end = input.length;
      } else {
        strings.push({ text: input.substring(i), start: i, end: input.length });
      }
    }
    return new SplitInterpolation(strings, expressions, offsets);
  }
  wrapLiteralPrimitive(input, location, absoluteOffset) {
    const span = new ParseSpan(0, input == null ? 0 : input.length);
    return new ASTWithSource(new LiteralPrimitive(span, span.toAbsolute(absoluteOffset), input), input, location, absoluteOffset, this.errors);
  }
  _stripComments(input) {
    const i = this._commentStart(input);
    return i != null ? input.substring(0, i) : input;
  }
  _commentStart(input) {
    let outerQuote = null;
    for (let i = 0; i < input.length - 1; i++) {
      const char = input.charCodeAt(i);
      const nextChar = input.charCodeAt(i + 1);
      if (char === $SLASH && nextChar == $SLASH && outerQuote == null)
        return i;
      if (outerQuote === char) {
        outerQuote = null;
      } else if (outerQuote == null && isQuote(char)) {
        outerQuote = char;
      }
    }
    return null;
  }
  _checkNoInterpolation(input, location, { start, end }) {
    let startIndex = -1;
    let endIndex = -1;
    for (const charIndex of this._forEachUnquotedChar(input, 0)) {
      if (startIndex === -1) {
        if (input.startsWith(start)) {
          startIndex = charIndex;
        }
      } else {
        endIndex = this._getInterpolationEndIndex(input, end, charIndex);
        if (endIndex > -1) {
          break;
        }
      }
    }
    if (startIndex > -1 && endIndex > -1) {
      this._reportError(`Got interpolation (${start}${end}) where expression was expected`, input, `at column ${startIndex} in`, location);
    }
  }
  /**
   * Finds the index of the end of an interpolation expression
   * while ignoring comments and quoted content.
   */
  _getInterpolationEndIndex(input, expressionEnd, start) {
    for (const charIndex of this._forEachUnquotedChar(input, start)) {
      if (input.startsWith(expressionEnd, charIndex)) {
        return charIndex;
      }
      if (input.startsWith("//", charIndex)) {
        return input.indexOf(expressionEnd, charIndex);
      }
    }
    return -1;
  }
  /**
   * Generator used to iterate over the character indexes of a string that are outside of quotes.
   * @param input String to loop through.
   * @param start Index within the string at which to start.
   */
  *_forEachUnquotedChar(input, start) {
    let currentQuote = null;
    let escapeCount = 0;
    for (let i = start; i < input.length; i++) {
      const char = input[i];
      if (isQuote(input.charCodeAt(i)) && (currentQuote === null || currentQuote === char) && escapeCount % 2 === 0) {
        currentQuote = currentQuote === null ? char : null;
      } else if (currentQuote === null) {
        yield i;
      }
      escapeCount = char === "\\" ? escapeCount + 1 : 0;
    }
  }
}
var ParseContextFlags;
(function(ParseContextFlags2) {
  ParseContextFlags2[ParseContextFlags2["None"] = 0] = "None";
  ParseContextFlags2[ParseContextFlags2["Writable"] = 1] = "Writable";
})(ParseContextFlags || (ParseContextFlags = {}));
class _ParseAST {
  input;
  location;
  absoluteOffset;
  tokens;
  parseFlags;
  errors;
  offset;
  rparensExpected = 0;
  rbracketsExpected = 0;
  rbracesExpected = 0;
  context = ParseContextFlags.None;
  // Cache of expression start and input indeces to the absolute source span they map to, used to
  // prevent creating superfluous source spans in `sourceSpan`.
  // A serial of the expression start and input index is used for mapping because both are stateful
  // and may change for subsequent expressions visited by the parser.
  sourceSpanCache = /* @__PURE__ */ new Map();
  index = 0;
  constructor(input, location, absoluteOffset, tokens, parseFlags, errors, offset) {
    this.input = input;
    this.location = location;
    this.absoluteOffset = absoluteOffset;
    this.tokens = tokens;
    this.parseFlags = parseFlags;
    this.errors = errors;
    this.offset = offset;
  }
  peek(offset) {
    const i = this.index + offset;
    return i < this.tokens.length ? this.tokens[i] : EOF;
  }
  get next() {
    return this.peek(0);
  }
  /** Whether all the parser input has been processed. */
  get atEOF() {
    return this.index >= this.tokens.length;
  }
  /**
   * Index of the next token to be processed, or the end of the last token if all have been
   * processed.
   */
  get inputIndex() {
    return this.atEOF ? this.currentEndIndex : this.next.index + this.offset;
  }
  /**
   * End index of the last processed token, or the start of the first token if none have been
   * processed.
   */
  get currentEndIndex() {
    if (this.index > 0) {
      const curToken = this.peek(-1);
      return curToken.end + this.offset;
    }
    if (this.tokens.length === 0) {
      return this.input.length + this.offset;
    }
    return this.next.index + this.offset;
  }
  /**
   * Returns the absolute offset of the start of the current token.
   */
  get currentAbsoluteOffset() {
    return this.absoluteOffset + this.inputIndex;
  }
  /**
   * Retrieve a `ParseSpan` from `start` to the current position (or to `artificialEndIndex` if
   * provided).
   *
   * @param start Position from which the `ParseSpan` will start.
   * @param artificialEndIndex Optional ending index to be used if provided (and if greater than the
   *     natural ending index)
   */
  span(start, artificialEndIndex) {
    let endIndex = this.currentEndIndex;
    if (artificialEndIndex !== void 0 && artificialEndIndex > this.currentEndIndex) {
      endIndex = artificialEndIndex;
    }
    if (start > endIndex) {
      const tmp = endIndex;
      endIndex = start;
      start = tmp;
    }
    return new ParseSpan(start, endIndex);
  }
  sourceSpan(start, artificialEndIndex) {
    const serial = `${start}@${this.inputIndex}:${artificialEndIndex}`;
    if (!this.sourceSpanCache.has(serial)) {
      this.sourceSpanCache.set(serial, this.span(start, artificialEndIndex).toAbsolute(this.absoluteOffset));
    }
    return this.sourceSpanCache.get(serial);
  }
  advance() {
    this.index++;
  }
  /**
   * Executes a callback in the provided context.
   */
  withContext(context, cb) {
    this.context |= context;
    const ret = cb();
    this.context ^= context;
    return ret;
  }
  consumeOptionalCharacter(code) {
    if (this.next.isCharacter(code)) {
      this.advance();
      return true;
    } else {
      return false;
    }
  }
  peekKeywordLet() {
    return this.next.isKeywordLet();
  }
  peekKeywordAs() {
    return this.next.isKeywordAs();
  }
  /**
   * Consumes an expected character, otherwise emits an error about the missing expected character
   * and skips over the token stream until reaching a recoverable point.
   *
   * See `this.error` and `this.skip` for more details.
   */
  expectCharacter(code) {
    if (this.consumeOptionalCharacter(code))
      return;
    this.error(`Missing expected ${String.fromCharCode(code)}`);
  }
  consumeOptionalOperator(op) {
    if (this.next.isOperator(op)) {
      this.advance();
      return true;
    } else {
      return false;
    }
  }
  expectOperator(operator) {
    if (this.consumeOptionalOperator(operator))
      return;
    this.error(`Missing expected operator ${operator}`);
  }
  prettyPrintToken(tok) {
    return tok === EOF ? "end of input" : `token ${tok}`;
  }
  expectIdentifierOrKeyword() {
    const n = this.next;
    if (!n.isIdentifier() && !n.isKeyword()) {
      if (n.isPrivateIdentifier()) {
        this._reportErrorForPrivateIdentifier(n, "expected identifier or keyword");
      } else {
        this.error(`Unexpected ${this.prettyPrintToken(n)}, expected identifier or keyword`);
      }
      return null;
    }
    this.advance();
    return n.toString();
  }
  expectIdentifierOrKeywordOrString() {
    const n = this.next;
    if (!n.isIdentifier() && !n.isKeyword() && !n.isString()) {
      if (n.isPrivateIdentifier()) {
        this._reportErrorForPrivateIdentifier(n, "expected identifier, keyword or string");
      } else {
        this.error(`Unexpected ${this.prettyPrintToken(n)}, expected identifier, keyword, or string`);
      }
      return "";
    }
    this.advance();
    return n.toString();
  }
  parseChain() {
    const exprs = [];
    const start = this.inputIndex;
    while (this.index < this.tokens.length) {
      const expr = this.parsePipe();
      exprs.push(expr);
      if (this.consumeOptionalCharacter($SEMICOLON)) {
        if (!(this.parseFlags & 1)) {
          this.error("Binding expression cannot contain chained expression");
        }
        while (this.consumeOptionalCharacter($SEMICOLON)) {
        }
      } else if (this.index < this.tokens.length) {
        const errorIndex = this.index;
        this.error(`Unexpected token '${this.next}'`);
        if (this.index === errorIndex) {
          break;
        }
      }
    }
    if (exprs.length === 0) {
      const artificialStart = this.offset;
      const artificialEnd = this.offset + this.input.length;
      return new EmptyExpr$1(this.span(artificialStart, artificialEnd), this.sourceSpan(artificialStart, artificialEnd));
    }
    if (exprs.length == 1)
      return exprs[0];
    return new Chain(this.span(start), this.sourceSpan(start), exprs);
  }
  parsePipe() {
    const start = this.inputIndex;
    let result = this.parseExpression();
    if (this.consumeOptionalOperator("|")) {
      if (this.parseFlags & 1) {
        this.error(`Cannot have a pipe in an action expression`);
      }
      do {
        const nameStart = this.inputIndex;
        let nameId = this.expectIdentifierOrKeyword();
        let nameSpan;
        let fullSpanEnd = void 0;
        if (nameId !== null) {
          nameSpan = this.sourceSpan(nameStart);
        } else {
          nameId = "";
          fullSpanEnd = this.next.index !== -1 ? this.next.index : this.input.length + this.offset;
          nameSpan = new ParseSpan(fullSpanEnd, fullSpanEnd).toAbsolute(this.absoluteOffset);
        }
        const args = [];
        while (this.consumeOptionalCharacter($COLON)) {
          args.push(this.parseExpression());
        }
        result = new BindingPipe(this.span(start), this.sourceSpan(start, fullSpanEnd), result, nameId, args, nameSpan);
      } while (this.consumeOptionalOperator("|"));
    }
    return result;
  }
  parseExpression() {
    return this.parseConditional();
  }
  parseConditional() {
    const start = this.inputIndex;
    const result = this.parseLogicalOr();
    if (this.consumeOptionalOperator("?")) {
      const yes = this.parsePipe();
      let no;
      if (!this.consumeOptionalCharacter($COLON)) {
        const end = this.inputIndex;
        const expression = this.input.substring(start, end);
        this.error(`Conditional expression ${expression} requires all 3 expressions`);
        no = new EmptyExpr$1(this.span(start), this.sourceSpan(start));
      } else {
        no = this.parsePipe();
      }
      return new Conditional(this.span(start), this.sourceSpan(start), result, yes, no);
    } else {
      return result;
    }
  }
  parseLogicalOr() {
    const start = this.inputIndex;
    let result = this.parseLogicalAnd();
    while (this.consumeOptionalOperator("||")) {
      const right = this.parseLogicalAnd();
      result = new Binary(this.span(start), this.sourceSpan(start), "||", result, right);
    }
    return result;
  }
  parseLogicalAnd() {
    const start = this.inputIndex;
    let result = this.parseNullishCoalescing();
    while (this.consumeOptionalOperator("&&")) {
      const right = this.parseNullishCoalescing();
      result = new Binary(this.span(start), this.sourceSpan(start), "&&", result, right);
    }
    return result;
  }
  parseNullishCoalescing() {
    const start = this.inputIndex;
    let result = this.parseEquality();
    while (this.consumeOptionalOperator("??")) {
      const right = this.parseEquality();
      result = new Binary(this.span(start), this.sourceSpan(start), "??", result, right);
    }
    return result;
  }
  parseEquality() {
    const start = this.inputIndex;
    let result = this.parseRelational();
    while (this.next.type == TokenType.Operator) {
      const operator = this.next.strValue;
      switch (operator) {
        case "==":
        case "===":
        case "!=":
        case "!==":
          this.advance();
          const right = this.parseRelational();
          result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
          continue;
      }
      break;
    }
    return result;
  }
  parseRelational() {
    const start = this.inputIndex;
    let result = this.parseAdditive();
    while (this.next.type == TokenType.Operator) {
      const operator = this.next.strValue;
      switch (operator) {
        case "<":
        case ">":
        case "<=":
        case ">=":
          this.advance();
          const right = this.parseAdditive();
          result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
          continue;
      }
      break;
    }
    return result;
  }
  parseAdditive() {
    const start = this.inputIndex;
    let result = this.parseMultiplicative();
    while (this.next.type == TokenType.Operator) {
      const operator = this.next.strValue;
      switch (operator) {
        case "+":
        case "-":
          this.advance();
          let right = this.parseMultiplicative();
          result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
          continue;
      }
      break;
    }
    return result;
  }
  parseMultiplicative() {
    const start = this.inputIndex;
    let result = this.parsePrefix();
    while (this.next.type == TokenType.Operator) {
      const operator = this.next.strValue;
      switch (operator) {
        case "*":
        case "%":
        case "/":
          this.advance();
          let right = this.parsePrefix();
          result = new Binary(this.span(start), this.sourceSpan(start), operator, result, right);
          continue;
      }
      break;
    }
    return result;
  }
  parsePrefix() {
    if (this.next.type == TokenType.Operator) {
      const start = this.inputIndex;
      const operator = this.next.strValue;
      let result;
      switch (operator) {
        case "+":
          this.advance();
          result = this.parsePrefix();
          return Unary.createPlus(this.span(start), this.sourceSpan(start), result);
        case "-":
          this.advance();
          result = this.parsePrefix();
          return Unary.createMinus(this.span(start), this.sourceSpan(start), result);
        case "!":
          this.advance();
          result = this.parsePrefix();
          return new PrefixNot(this.span(start), this.sourceSpan(start), result);
      }
    } else if (this.next.isKeywordTypeof()) {
      this.advance();
      const start = this.inputIndex;
      let result = this.parsePrefix();
      return new TypeofExpression(this.span(start), this.sourceSpan(start), result);
    }
    return this.parseCallChain();
  }
  parseCallChain() {
    const start = this.inputIndex;
    let result = this.parsePrimary();
    while (true) {
      if (this.consumeOptionalCharacter($PERIOD)) {
        result = this.parseAccessMember(result, start, false);
      } else if (this.consumeOptionalOperator("?.")) {
        if (this.consumeOptionalCharacter($LPAREN)) {
          result = this.parseCall(result, start, true);
        } else {
          result = this.consumeOptionalCharacter($LBRACKET) ? this.parseKeyedReadOrWrite(result, start, true) : this.parseAccessMember(result, start, true);
        }
      } else if (this.consumeOptionalCharacter($LBRACKET)) {
        result = this.parseKeyedReadOrWrite(result, start, false);
      } else if (this.consumeOptionalCharacter($LPAREN)) {
        result = this.parseCall(result, start, false);
      } else if (this.consumeOptionalOperator("!")) {
        result = new NonNullAssert(this.span(start), this.sourceSpan(start), result);
      } else {
        return result;
      }
    }
  }
  parsePrimary() {
    const start = this.inputIndex;
    if (this.consumeOptionalCharacter($LPAREN)) {
      this.rparensExpected++;
      const result = this.parsePipe();
      this.rparensExpected--;
      this.expectCharacter($RPAREN);
      return result;
    } else if (this.next.isKeywordNull()) {
      this.advance();
      return new LiteralPrimitive(this.span(start), this.sourceSpan(start), null);
    } else if (this.next.isKeywordUndefined()) {
      this.advance();
      return new LiteralPrimitive(this.span(start), this.sourceSpan(start), void 0);
    } else if (this.next.isKeywordTrue()) {
      this.advance();
      return new LiteralPrimitive(this.span(start), this.sourceSpan(start), true);
    } else if (this.next.isKeywordFalse()) {
      this.advance();
      return new LiteralPrimitive(this.span(start), this.sourceSpan(start), false);
    } else if (this.next.isKeywordThis()) {
      this.advance();
      return new ThisReceiver(this.span(start), this.sourceSpan(start));
    } else if (this.consumeOptionalCharacter($LBRACKET)) {
      this.rbracketsExpected++;
      const elements = this.parseExpressionList($RBRACKET);
      this.rbracketsExpected--;
      this.expectCharacter($RBRACKET);
      return new LiteralArray(this.span(start), this.sourceSpan(start), elements);
    } else if (this.next.isCharacter($LBRACE)) {
      return this.parseLiteralMap();
    } else if (this.next.isIdentifier()) {
      return this.parseAccessMember(new ImplicitReceiver(this.span(start), this.sourceSpan(start)), start, false);
    } else if (this.next.isNumber()) {
      const value = this.next.toNumber();
      this.advance();
      return new LiteralPrimitive(this.span(start), this.sourceSpan(start), value);
    } else if (this.next.isString()) {
      const literalValue = this.next.toString();
      this.advance();
      return new LiteralPrimitive(this.span(start), this.sourceSpan(start), literalValue);
    } else if (this.next.isPrivateIdentifier()) {
      this._reportErrorForPrivateIdentifier(this.next, null);
      return new EmptyExpr$1(this.span(start), this.sourceSpan(start));
    } else if (this.index >= this.tokens.length) {
      this.error(`Unexpected end of expression: ${this.input}`);
      return new EmptyExpr$1(this.span(start), this.sourceSpan(start));
    } else {
      this.error(`Unexpected token ${this.next}`);
      return new EmptyExpr$1(this.span(start), this.sourceSpan(start));
    }
  }
  parseExpressionList(terminator) {
    const result = [];
    do {
      if (!this.next.isCharacter(terminator)) {
        result.push(this.parsePipe());
      } else {
        break;
      }
    } while (this.consumeOptionalCharacter($COMMA));
    return result;
  }
  parseLiteralMap() {
    const keys = [];
    const values = [];
    const start = this.inputIndex;
    this.expectCharacter($LBRACE);
    if (!this.consumeOptionalCharacter($RBRACE)) {
      this.rbracesExpected++;
      do {
        const keyStart = this.inputIndex;
        const quoted = this.next.isString();
        const key = this.expectIdentifierOrKeywordOrString();
        const literalMapKey = { key, quoted };
        keys.push(literalMapKey);
        if (quoted) {
          this.expectCharacter($COLON);
          values.push(this.parsePipe());
        } else if (this.consumeOptionalCharacter($COLON)) {
          values.push(this.parsePipe());
        } else {
          literalMapKey.isShorthandInitialized = true;
          const span = this.span(keyStart);
          const sourceSpan = this.sourceSpan(keyStart);
          values.push(new PropertyRead(span, sourceSpan, sourceSpan, new ImplicitReceiver(span, sourceSpan), key));
        }
      } while (this.consumeOptionalCharacter($COMMA) && !this.next.isCharacter($RBRACE));
      this.rbracesExpected--;
      this.expectCharacter($RBRACE);
    }
    return new LiteralMap(this.span(start), this.sourceSpan(start), keys, values);
  }
  parseAccessMember(readReceiver, start, isSafe) {
    const nameStart = this.inputIndex;
    const id = this.withContext(ParseContextFlags.Writable, () => {
      const id2 = this.expectIdentifierOrKeyword() ?? "";
      if (id2.length === 0) {
        this.error(`Expected identifier for property access`, readReceiver.span.end);
      }
      return id2;
    });
    const nameSpan = this.sourceSpan(nameStart);
    let receiver;
    if (isSafe) {
      if (this.consumeOptionalOperator("=")) {
        this.error("The '?.' operator cannot be used in the assignment");
        receiver = new EmptyExpr$1(this.span(start), this.sourceSpan(start));
      } else {
        receiver = new SafePropertyRead(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id);
      }
    } else {
      if (this.consumeOptionalOperator("=")) {
        if (!(this.parseFlags & 1)) {
          this.error("Bindings cannot contain assignments");
          return new EmptyExpr$1(this.span(start), this.sourceSpan(start));
        }
        const value = this.parseConditional();
        receiver = new PropertyWrite(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id, value);
      } else {
        receiver = new PropertyRead(this.span(start), this.sourceSpan(start), nameSpan, readReceiver, id);
      }
    }
    return receiver;
  }
  parseCall(receiver, start, isSafe) {
    const argumentStart = this.inputIndex;
    this.rparensExpected++;
    const args = this.parseCallArguments();
    const argumentSpan = this.span(argumentStart, this.inputIndex).toAbsolute(this.absoluteOffset);
    this.expectCharacter($RPAREN);
    this.rparensExpected--;
    const span = this.span(start);
    const sourceSpan = this.sourceSpan(start);
    return isSafe ? new SafeCall(span, sourceSpan, receiver, args, argumentSpan) : new Call(span, sourceSpan, receiver, args, argumentSpan);
  }
  parseCallArguments() {
    if (this.next.isCharacter($RPAREN))
      return [];
    const positionals = [];
    do {
      positionals.push(this.parsePipe());
    } while (this.consumeOptionalCharacter($COMMA));
    return positionals;
  }
  /**
   * Parses an identifier, a keyword, a string with an optional `-` in between,
   * and returns the string along with its absolute source span.
   */
  expectTemplateBindingKey() {
    let result = "";
    let operatorFound = false;
    const start = this.currentAbsoluteOffset;
    do {
      result += this.expectIdentifierOrKeywordOrString();
      operatorFound = this.consumeOptionalOperator("-");
      if (operatorFound) {
        result += "-";
      }
    } while (operatorFound);
    return {
      source: result,
      span: new AbsoluteSourceSpan(start, start + result.length)
    };
  }
  /**
   * Parse microsyntax template expression and return a list of bindings or
   * parsing errors in case the given expression is invalid.
   *
   * For example,
   * ```
   *   <div *ngFor="let item of items; index as i; trackBy: func">
   * ```
   * contains five bindings:
   * 1. ngFor -> null
   * 2. item -> NgForOfContext.$implicit
   * 3. ngForOf -> items
   * 4. i -> NgForOfContext.index
   * 5. ngForTrackBy -> func
   *
   * For a full description of the microsyntax grammar, see
   * https://gist.github.com/mhevery/d3530294cff2e4a1b3fe15ff75d08855
   *
   * @param templateKey name of the microsyntax directive, like ngIf, ngFor,
   * without the *, along with its absolute span.
   */
  parseTemplateBindings(templateKey) {
    const bindings = [];
    bindings.push(...this.parseDirectiveKeywordBindings(templateKey));
    while (this.index < this.tokens.length) {
      const letBinding = this.parseLetBinding();
      if (letBinding) {
        bindings.push(letBinding);
      } else {
        const key = this.expectTemplateBindingKey();
        const binding = this.parseAsBinding(key);
        if (binding) {
          bindings.push(binding);
        } else {
          key.source = templateKey.source + key.source.charAt(0).toUpperCase() + key.source.substring(1);
          bindings.push(...this.parseDirectiveKeywordBindings(key));
        }
      }
      this.consumeStatementTerminator();
    }
    return new TemplateBindingParseResult(bindings, [], this.errors);
  }
  parseKeyedReadOrWrite(receiver, start, isSafe) {
    return this.withContext(ParseContextFlags.Writable, () => {
      this.rbracketsExpected++;
      const key = this.parsePipe();
      if (key instanceof EmptyExpr$1) {
        this.error(`Key access cannot be empty`);
      }
      this.rbracketsExpected--;
      this.expectCharacter($RBRACKET);
      if (this.consumeOptionalOperator("=")) {
        if (isSafe) {
          this.error("The '?.' operator cannot be used in the assignment");
        } else {
          const value = this.parseConditional();
          return new KeyedWrite(this.span(start), this.sourceSpan(start), receiver, key, value);
        }
      } else {
        return isSafe ? new SafeKeyedRead(this.span(start), this.sourceSpan(start), receiver, key) : new KeyedRead(this.span(start), this.sourceSpan(start), receiver, key);
      }
      return new EmptyExpr$1(this.span(start), this.sourceSpan(start));
    });
  }
  /**
   * Parse a directive keyword, followed by a mandatory expression.
   * For example, "of items", "trackBy: func".
   * The bindings are: ngForOf -> items, ngForTrackBy -> func
   * There could be an optional "as" binding that follows the expression.
   * For example,
   * ```
   *   *ngFor="let item of items | slice:0:1 as collection".
   *                    ^^ ^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^
   *               keyword    bound target   optional 'as' binding
   * ```
   *
   * @param key binding key, for example, ngFor, ngIf, ngForOf, along with its
   * absolute span.
   */
  parseDirectiveKeywordBindings(key) {
    const bindings = [];
    this.consumeOptionalCharacter($COLON);
    const value = this.getDirectiveBoundTarget();
    let spanEnd = this.currentAbsoluteOffset;
    const asBinding = this.parseAsBinding(key);
    if (!asBinding) {
      this.consumeStatementTerminator();
      spanEnd = this.currentAbsoluteOffset;
    }
    const sourceSpan = new AbsoluteSourceSpan(key.span.start, spanEnd);
    bindings.push(new ExpressionBinding(sourceSpan, key, value));
    if (asBinding) {
      bindings.push(asBinding);
    }
    return bindings;
  }
  /**
   * Return the expression AST for the bound target of a directive keyword
   * binding. For example,
   * ```
   *   *ngIf="condition | pipe"
   *          ^^^^^^^^^^^^^^^^ bound target for "ngIf"
   *   *ngFor="let item of items"
   *                       ^^^^^ bound target for "ngForOf"
   * ```
   */
  getDirectiveBoundTarget() {
    if (this.next === EOF || this.peekKeywordAs() || this.peekKeywordLet()) {
      return null;
    }
    const ast = this.parsePipe();
    const { start, end } = ast.span;
    const value = this.input.substring(start, end);
    return new ASTWithSource(ast, value, this.location, this.absoluteOffset + start, this.errors);
  }
  /**
   * Return the binding for a variable declared using `as`. Note that the order
   * of the key-value pair in this declaration is reversed. For example,
   * ```
   *   *ngFor="let item of items; index as i"
   *                              ^^^^^    ^
   *                              value    key
   * ```
   *
   * @param value name of the value in the declaration, "ngIf" in the example
   * above, along with its absolute span.
   */
  parseAsBinding(value) {
    if (!this.peekKeywordAs()) {
      return null;
    }
    this.advance();
    const key = this.expectTemplateBindingKey();
    this.consumeStatementTerminator();
    const sourceSpan = new AbsoluteSourceSpan(value.span.start, this.currentAbsoluteOffset);
    return new VariableBinding(sourceSpan, key, value);
  }
  /**
   * Return the binding for a variable declared using `let`. For example,
   * ```
   *   *ngFor="let item of items; let i=index;"
   *           ^^^^^^^^           ^^^^^^^^^^^
   * ```
   * In the first binding, `item` is bound to `NgForOfContext.$implicit`.
   * In the second binding, `i` is bound to `NgForOfContext.index`.
   */
  parseLetBinding() {
    if (!this.peekKeywordLet()) {
      return null;
    }
    const spanStart = this.currentAbsoluteOffset;
    this.advance();
    const key = this.expectTemplateBindingKey();
    let value = null;
    if (this.consumeOptionalOperator("=")) {
      value = this.expectTemplateBindingKey();
    }
    this.consumeStatementTerminator();
    const sourceSpan = new AbsoluteSourceSpan(spanStart, this.currentAbsoluteOffset);
    return new VariableBinding(sourceSpan, key, value);
  }
  /**
   * Consume the optional statement terminator: semicolon or comma.
   */
  consumeStatementTerminator() {
    this.consumeOptionalCharacter($SEMICOLON) || this.consumeOptionalCharacter($COMMA);
  }
  /**
   * Records an error and skips over the token stream until reaching a recoverable point. See
   * `this.skip` for more details on token skipping.
   */
  error(message, index = null) {
    this.errors.push(new ParserError(message, this.input, this.locationText(index), this.location));
    this.skip();
  }
  locationText(index = null) {
    if (index == null)
      index = this.index;
    return index < this.tokens.length ? `at column ${this.tokens[index].index + 1} in` : `at the end of the expression`;
  }
  /**
   * Records an error for an unexpected private identifier being discovered.
   * @param token Token representing a private identifier.
   * @param extraMessage Optional additional message being appended to the error.
   */
  _reportErrorForPrivateIdentifier(token, extraMessage) {
    let errorMessage = `Private identifiers are not supported. Unexpected private identifier: ${token}`;
    if (extraMessage !== null) {
      errorMessage += `, ${extraMessage}`;
    }
    this.error(errorMessage);
  }
  /**
   * Error recovery should skip tokens until it encounters a recovery point.
   *
   * The following are treated as unconditional recovery points:
   *   - end of input
   *   - ';' (parseChain() is always the root production, and it expects a ';')
   *   - '|' (since pipes may be chained and each pipe expression may be treated independently)
   *
   * The following are conditional recovery points:
   *   - ')', '}', ']' if one of calling productions is expecting one of these symbols
   *     - This allows skip() to recover from errors such as '(a.) + 1' allowing more of the AST to
   *       be retained (it doesn't skip any tokens as the ')' is retained because of the '(' begins
   *       an '(' <expr> ')' production).
   *       The recovery points of grouping symbols must be conditional as they must be skipped if
   *       none of the calling productions are not expecting the closing token else we will never
   *       make progress in the case of an extraneous group closing symbol (such as a stray ')').
   *       That is, we skip a closing symbol if we are not in a grouping production.
   *   - '=' in a `Writable` context
   *     - In this context, we are able to recover after seeing the `=` operator, which
   *       signals the presence of an independent rvalue expression following the `=` operator.
   *
   * If a production expects one of these token it increments the corresponding nesting count,
   * and then decrements it just prior to checking if the token is in the input.
   */
  skip() {
    let n = this.next;
    while (this.index < this.tokens.length && !n.isCharacter($SEMICOLON) && !n.isOperator("|") && (this.rparensExpected <= 0 || !n.isCharacter($RPAREN)) && (this.rbracesExpected <= 0 || !n.isCharacter($RBRACE)) && (this.rbracketsExpected <= 0 || !n.isCharacter($RBRACKET)) && (!(this.context & ParseContextFlags.Writable) || !n.isOperator("="))) {
      if (this.next.isError()) {
        this.errors.push(new ParserError(this.next.toString(), this.input, this.locationText(), this.location));
      }
      this.advance();
      n = this.next;
    }
  }
}
class SimpleExpressionChecker extends RecursiveAstVisitor {
  errors = [];
  visitPipe() {
    this.errors.push("pipes");
  }
}
function getIndexMapForOriginalTemplate(interpolatedTokens) {
  let offsetMap = /* @__PURE__ */ new Map();
  let consumedInOriginalTemplate = 0;
  let consumedInInput = 0;
  let tokenIndex = 0;
  while (tokenIndex < interpolatedTokens.length) {
    const currentToken = interpolatedTokens[tokenIndex];
    if (currentToken.type === 9) {
      const [decoded, encoded] = currentToken.parts;
      consumedInOriginalTemplate += encoded.length;
      consumedInInput += decoded.length;
    } else {
      const lengthOfParts = currentToken.parts.reduce((sum, current) => sum + current.length, 0);
      consumedInInput += lengthOfParts;
      consumedInOriginalTemplate += lengthOfParts;
    }
    offsetMap.set(consumedInInput, consumedInOriginalTemplate);
    tokenIndex++;
  }
  return offsetMap;
}
function serialize(expression) {
  return expression.visit(new SerializeExpressionVisitor());
}
class SerializeExpressionVisitor {
  visitUnary(ast, context) {
    return `${ast.operator}${ast.expr.visit(this, context)}`;
  }
  visitBinary(ast, context) {
    return `${ast.left.visit(this, context)} ${ast.operation} ${ast.right.visit(this, context)}`;
  }
  visitChain(ast, context) {
    return ast.expressions.map((e) => e.visit(this, context)).join("; ");
  }
  visitConditional(ast, context) {
    return `${ast.condition.visit(this, context)} ? ${ast.trueExp.visit(this, context)} : ${ast.falseExp.visit(this, context)}`;
  }
  visitThisReceiver() {
    return "this";
  }
  visitImplicitReceiver() {
    return "";
  }
  visitInterpolation(ast, context) {
    return interleave(ast.strings, ast.expressions.map((e) => e.visit(this, context))).join("");
  }
  visitKeyedRead(ast, context) {
    return `${ast.receiver.visit(this, context)}[${ast.key.visit(this, context)}]`;
  }
  visitKeyedWrite(ast, context) {
    return `${ast.receiver.visit(this, context)}[${ast.key.visit(this, context)}] = ${ast.value.visit(this, context)}`;
  }
  visitLiteralArray(ast, context) {
    return `[${ast.expressions.map((e) => e.visit(this, context)).join(", ")}]`;
  }
  visitLiteralMap(ast, context) {
    return `{${zip(ast.keys.map((literal2) => literal2.quoted ? `'${literal2.key}'` : literal2.key), ast.values.map((value) => value.visit(this, context))).map(([key, value]) => `${key}: ${value}`).join(", ")}}`;
  }
  visitLiteralPrimitive(ast) {
    if (ast.value === null)
      return "null";
    switch (typeof ast.value) {
      case "number":
      case "boolean":
        return ast.value.toString();
      case "undefined":
        return "undefined";
      case "string":
        return `'${ast.value.replace(/'/g, `\\'`)}'`;
      default:
        throw new Error(`Unsupported primitive type: ${ast.value}`);
    }
  }
  visitPipe(ast, context) {
    return `${ast.exp.visit(this, context)} | ${ast.name}`;
  }
  visitPrefixNot(ast, context) {
    return `!${ast.expression.visit(this, context)}`;
  }
  visitNonNullAssert(ast, context) {
    return `${ast.expression.visit(this, context)}!`;
  }
  visitPropertyRead(ast, context) {
    if (ast.receiver instanceof ImplicitReceiver) {
      return ast.name;
    } else {
      return `${ast.receiver.visit(this, context)}.${ast.name}`;
    }
  }
  visitPropertyWrite(ast, context) {
    if (ast.receiver instanceof ImplicitReceiver) {
      return `${ast.name} = ${ast.value.visit(this, context)}`;
    } else {
      return `${ast.receiver.visit(this, context)}.${ast.name} = ${ast.value.visit(this, context)}`;
    }
  }
  visitSafePropertyRead(ast, context) {
    return `${ast.receiver.visit(this, context)}?.${ast.name}`;
  }
  visitSafeKeyedRead(ast, context) {
    return `${ast.receiver.visit(this, context)}?.[${ast.key.visit(this, context)}]`;
  }
  visitCall(ast, context) {
    return `${ast.receiver.visit(this, context)}(${ast.args.map((e) => e.visit(this, context)).join(", ")})`;
  }
  visitSafeCall(ast, context) {
    return `${ast.receiver.visit(this, context)}?.(${ast.args.map((e) => e.visit(this, context)).join(", ")})`;
  }
  visitTypeofExpresion(ast, context) {
    return `typeof ${ast.expression.visit(this, context)}`;
  }
  visitASTWithSource(ast, context) {
    return ast.ast.visit(this, context);
  }
}
function zip(left, right) {
  if (left.length !== right.length)
    throw new Error("Array lengths must match");
  return left.map((l, i) => [l, right[i]]);
}
function interleave(left, right) {
  const result = [];
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if (index < left.length)
      result.push(left[index]);
    if (index < right.length)
      result.push(right[index]);
  }
  return result;
}
let _SECURITY_SCHEMA;
function SECURITY_SCHEMA() {
  if (!_SECURITY_SCHEMA) {
    _SECURITY_SCHEMA = {};
    registerContext(SecurityContext.HTML, ["iframe|srcdoc", "*|innerHTML", "*|outerHTML"]);
    registerContext(SecurityContext.STYLE, ["*|style"]);
    registerContext(SecurityContext.URL, [
      "*|formAction",
      "area|href",
      "area|ping",
      "audio|src",
      "a|href",
      "a|ping",
      "blockquote|cite",
      "body|background",
      "del|cite",
      "form|action",
      "img|src",
      "input|src",
      "ins|cite",
      "q|cite",
      "source|src",
      "track|src",
      "video|poster",
      "video|src"
    ]);
    registerContext(SecurityContext.RESOURCE_URL, [
      "applet|code",
      "applet|codebase",
      "base|href",
      "embed|src",
      "frame|src",
      "head|profile",
      "html|manifest",
      "iframe|src",
      "link|href",
      "media|src",
      "object|codebase",
      "object|data",
      "script|src"
    ]);
  }
  return _SECURITY_SCHEMA;
}
function registerContext(ctx, specs) {
  for (const spec of specs)
    _SECURITY_SCHEMA[spec.toLowerCase()] = ctx;
}
const IFRAME_SECURITY_SENSITIVE_ATTRS = /* @__PURE__ */ new Set([
  "sandbox",
  "allow",
  "allowfullscreen",
  "referrerpolicy",
  "csp",
  "fetchpriority"
]);
function isIframeSecuritySensitiveAttr(attrName) {
  return IFRAME_SECURITY_SENSITIVE_ATTRS.has(attrName.toLowerCase());
}
class ElementSchemaRegistry {
}
const BOOLEAN = "boolean";
const NUMBER = "number";
const STRING = "string";
const OBJECT = "object";
const SCHEMA = [
  "[Element]|textContent,%ariaAtomic,%ariaAutoComplete,%ariaBusy,%ariaChecked,%ariaColCount,%ariaColIndex,%ariaColSpan,%ariaCurrent,%ariaDescription,%ariaDisabled,%ariaExpanded,%ariaHasPopup,%ariaHidden,%ariaKeyShortcuts,%ariaLabel,%ariaLevel,%ariaLive,%ariaModal,%ariaMultiLine,%ariaMultiSelectable,%ariaOrientation,%ariaPlaceholder,%ariaPosInSet,%ariaPressed,%ariaReadOnly,%ariaRelevant,%ariaRequired,%ariaRoleDescription,%ariaRowCount,%ariaRowIndex,%ariaRowSpan,%ariaSelected,%ariaSetSize,%ariaSort,%ariaValueMax,%ariaValueMin,%ariaValueNow,%ariaValueText,%classList,className,elementTiming,id,innerHTML,*beforecopy,*beforecut,*beforepaste,*fullscreenchange,*fullscreenerror,*search,*webkitfullscreenchange,*webkitfullscreenerror,outerHTML,%part,#scrollLeft,#scrollTop,slot,*message,*mozfullscreenchange,*mozfullscreenerror,*mozpointerlockchange,*mozpointerlockerror,*webglcontextcreationerror,*webglcontextlost,*webglcontextrestored",
  "[HTMLElement]^[Element]|accessKey,autocapitalize,!autofocus,contentEditable,dir,!draggable,enterKeyHint,!hidden,!inert,innerText,inputMode,lang,nonce,*abort,*animationend,*animationiteration,*animationstart,*auxclick,*beforexrselect,*blur,*cancel,*canplay,*canplaythrough,*change,*click,*close,*contextmenu,*copy,*cuechange,*cut,*dblclick,*drag,*dragend,*dragenter,*dragleave,*dragover,*dragstart,*drop,*durationchange,*emptied,*ended,*error,*focus,*formdata,*gotpointercapture,*input,*invalid,*keydown,*keypress,*keyup,*load,*loadeddata,*loadedmetadata,*loadstart,*lostpointercapture,*mousedown,*mouseenter,*mouseleave,*mousemove,*mouseout,*mouseover,*mouseup,*mousewheel,*paste,*pause,*play,*playing,*pointercancel,*pointerdown,*pointerenter,*pointerleave,*pointermove,*pointerout,*pointerover,*pointerrawupdate,*pointerup,*progress,*ratechange,*reset,*resize,*scroll,*securitypolicyviolation,*seeked,*seeking,*select,*selectionchange,*selectstart,*slotchange,*stalled,*submit,*suspend,*timeupdate,*toggle,*transitioncancel,*transitionend,*transitionrun,*transitionstart,*volumechange,*waiting,*webkitanimationend,*webkitanimationiteration,*webkitanimationstart,*webkittransitionend,*wheel,outerText,!spellcheck,%style,#tabIndex,title,!translate,virtualKeyboardPolicy",
  "abbr,address,article,aside,b,bdi,bdo,cite,content,code,dd,dfn,dt,em,figcaption,figure,footer,header,hgroup,i,kbd,main,mark,nav,noscript,rb,rp,rt,rtc,ruby,s,samp,section,small,strong,sub,sup,u,var,wbr^[HTMLElement]|accessKey,autocapitalize,!autofocus,contentEditable,dir,!draggable,enterKeyHint,!hidden,innerText,inputMode,lang,nonce,*abort,*animationend,*animationiteration,*animationstart,*auxclick,*beforexrselect,*blur,*cancel,*canplay,*canplaythrough,*change,*click,*close,*contextmenu,*copy,*cuechange,*cut,*dblclick,*drag,*dragend,*dragenter,*dragleave,*dragover,*dragstart,*drop,*durationchange,*emptied,*ended,*error,*focus,*formdata,*gotpointercapture,*input,*invalid,*keydown,*keypress,*keyup,*load,*loadeddata,*loadedmetadata,*loadstart,*lostpointercapture,*mousedown,*mouseenter,*mouseleave,*mousemove,*mouseout,*mouseover,*mouseup,*mousewheel,*paste,*pause,*play,*playing,*pointercancel,*pointerdown,*pointerenter,*pointerleave,*pointermove,*pointerout,*pointerover,*pointerrawupdate,*pointerup,*progress,*ratechange,*reset,*resize,*scroll,*securitypolicyviolation,*seeked,*seeking,*select,*selectionchange,*selectstart,*slotchange,*stalled,*submit,*suspend,*timeupdate,*toggle,*transitioncancel,*transitionend,*transitionrun,*transitionstart,*volumechange,*waiting,*webkitanimationend,*webkitanimationiteration,*webkitanimationstart,*webkittransitionend,*wheel,outerText,!spellcheck,%style,#tabIndex,title,!translate,virtualKeyboardPolicy",
  "media^[HTMLElement]|!autoplay,!controls,%controlsList,%crossOrigin,#currentTime,!defaultMuted,#defaultPlaybackRate,!disableRemotePlayback,!loop,!muted,*encrypted,*waitingforkey,#playbackRate,preload,!preservesPitch,src,%srcObject,#volume",
  ":svg:^[HTMLElement]|!autofocus,nonce,*abort,*animationend,*animationiteration,*animationstart,*auxclick,*beforexrselect,*blur,*cancel,*canplay,*canplaythrough,*change,*click,*close,*contextmenu,*copy,*cuechange,*cut,*dblclick,*drag,*dragend,*dragenter,*dragleave,*dragover,*dragstart,*drop,*durationchange,*emptied,*ended,*error,*focus,*formdata,*gotpointercapture,*input,*invalid,*keydown,*keypress,*keyup,*load,*loadeddata,*loadedmetadata,*loadstart,*lostpointercapture,*mousedown,*mouseenter,*mouseleave,*mousemove,*mouseout,*mouseover,*mouseup,*mousewheel,*paste,*pause,*play,*playing,*pointercancel,*pointerdown,*pointerenter,*pointerleave,*pointermove,*pointerout,*pointerover,*pointerrawupdate,*pointerup,*progress,*ratechange,*reset,*resize,*scroll,*securitypolicyviolation,*seeked,*seeking,*select,*selectionchange,*selectstart,*slotchange,*stalled,*submit,*suspend,*timeupdate,*toggle,*transitioncancel,*transitionend,*transitionrun,*transitionstart,*volumechange,*waiting,*webkitanimationend,*webkitanimationiteration,*webkitanimationstart,*webkittransitionend,*wheel,%style,#tabIndex",
  ":svg:graphics^:svg:|",
  ":svg:animation^:svg:|*begin,*end,*repeat",
  ":svg:geometry^:svg:|",
  ":svg:componentTransferFunction^:svg:|",
  ":svg:gradient^:svg:|",
  ":svg:textContent^:svg:graphics|",
  ":svg:textPositioning^:svg:textContent|",
  "a^[HTMLElement]|charset,coords,download,hash,host,hostname,href,hreflang,name,password,pathname,ping,port,protocol,referrerPolicy,rel,%relList,rev,search,shape,target,text,type,username",
  "area^[HTMLElement]|alt,coords,download,hash,host,hostname,href,!noHref,password,pathname,ping,port,protocol,referrerPolicy,rel,%relList,search,shape,target,username",
  "audio^media|",
  "br^[HTMLElement]|clear",
  "base^[HTMLElement]|href,target",
  "body^[HTMLElement]|aLink,background,bgColor,link,*afterprint,*beforeprint,*beforeunload,*blur,*error,*focus,*hashchange,*languagechange,*load,*message,*messageerror,*offline,*online,*pagehide,*pageshow,*popstate,*rejectionhandled,*resize,*scroll,*storage,*unhandledrejection,*unload,text,vLink",
  "button^[HTMLElement]|!disabled,formAction,formEnctype,formMethod,!formNoValidate,formTarget,name,type,value",
  "canvas^[HTMLElement]|#height,#width",
  "content^[HTMLElement]|select",
  "dl^[HTMLElement]|!compact",
  "data^[HTMLElement]|value",
  "datalist^[HTMLElement]|",
  "details^[HTMLElement]|!open",
  "dialog^[HTMLElement]|!open,returnValue",
  "dir^[HTMLElement]|!compact",
  "div^[HTMLElement]|align",
  "embed^[HTMLElement]|align,height,name,src,type,width",
  "fieldset^[HTMLElement]|!disabled,name",
  "font^[HTMLElement]|color,face,size",
  "form^[HTMLElement]|acceptCharset,action,autocomplete,encoding,enctype,method,name,!noValidate,target",
  "frame^[HTMLElement]|frameBorder,longDesc,marginHeight,marginWidth,name,!noResize,scrolling,src",
  "frameset^[HTMLElement]|cols,*afterprint,*beforeprint,*beforeunload,*blur,*error,*focus,*hashchange,*languagechange,*load,*message,*messageerror,*offline,*online,*pagehide,*pageshow,*popstate,*rejectionhandled,*resize,*scroll,*storage,*unhandledrejection,*unload,rows",
  "hr^[HTMLElement]|align,color,!noShade,size,width",
  "head^[HTMLElement]|",
  "h1,h2,h3,h4,h5,h6^[HTMLElement]|align",
  "html^[HTMLElement]|version",
  "iframe^[HTMLElement]|align,allow,!allowFullscreen,!allowPaymentRequest,csp,frameBorder,height,loading,longDesc,marginHeight,marginWidth,name,referrerPolicy,%sandbox,scrolling,src,srcdoc,width",
  "img^[HTMLElement]|align,alt,border,%crossOrigin,decoding,#height,#hspace,!isMap,loading,longDesc,lowsrc,name,referrerPolicy,sizes,src,srcset,useMap,#vspace,#width",
  "input^[HTMLElement]|accept,align,alt,autocomplete,!checked,!defaultChecked,defaultValue,dirName,!disabled,%files,formAction,formEnctype,formMethod,!formNoValidate,formTarget,#height,!incremental,!indeterminate,max,#maxLength,min,#minLength,!multiple,name,pattern,placeholder,!readOnly,!required,selectionDirection,#selectionEnd,#selectionStart,#size,src,step,type,useMap,value,%valueAsDate,#valueAsNumber,#width",
  "li^[HTMLElement]|type,#value",
  "label^[HTMLElement]|htmlFor",
  "legend^[HTMLElement]|align",
  "link^[HTMLElement]|as,charset,%crossOrigin,!disabled,href,hreflang,imageSizes,imageSrcset,integrity,media,referrerPolicy,rel,%relList,rev,%sizes,target,type",
  "map^[HTMLElement]|name",
  "marquee^[HTMLElement]|behavior,bgColor,direction,height,#hspace,#loop,#scrollAmount,#scrollDelay,!trueSpeed,#vspace,width",
  "menu^[HTMLElement]|!compact",
  "meta^[HTMLElement]|content,httpEquiv,media,name,scheme",
  "meter^[HTMLElement]|#high,#low,#max,#min,#optimum,#value",
  "ins,del^[HTMLElement]|cite,dateTime",
  "ol^[HTMLElement]|!compact,!reversed,#start,type",
  "object^[HTMLElement]|align,archive,border,code,codeBase,codeType,data,!declare,height,#hspace,name,standby,type,useMap,#vspace,width",
  "optgroup^[HTMLElement]|!disabled,label",
  "option^[HTMLElement]|!defaultSelected,!disabled,label,!selected,text,value",
  "output^[HTMLElement]|defaultValue,%htmlFor,name,value",
  "p^[HTMLElement]|align",
  "param^[HTMLElement]|name,type,value,valueType",
  "picture^[HTMLElement]|",
  "pre^[HTMLElement]|#width",
  "progress^[HTMLElement]|#max,#value",
  "q,blockquote,cite^[HTMLElement]|",
  "script^[HTMLElement]|!async,charset,%crossOrigin,!defer,event,htmlFor,integrity,!noModule,%referrerPolicy,src,text,type",
  "select^[HTMLElement]|autocomplete,!disabled,#length,!multiple,name,!required,#selectedIndex,#size,value",
  "slot^[HTMLElement]|name",
  "source^[HTMLElement]|#height,media,sizes,src,srcset,type,#width",
  "span^[HTMLElement]|",
  "style^[HTMLElement]|!disabled,media,type",
  "caption^[HTMLElement]|align",
  "th,td^[HTMLElement]|abbr,align,axis,bgColor,ch,chOff,#colSpan,headers,height,!noWrap,#rowSpan,scope,vAlign,width",
  "col,colgroup^[HTMLElement]|align,ch,chOff,#span,vAlign,width",
  "table^[HTMLElement]|align,bgColor,border,%caption,cellPadding,cellSpacing,frame,rules,summary,%tFoot,%tHead,width",
  "tr^[HTMLElement]|align,bgColor,ch,chOff,vAlign",
  "tfoot,thead,tbody^[HTMLElement]|align,ch,chOff,vAlign",
  "template^[HTMLElement]|",
  "textarea^[HTMLElement]|autocomplete,#cols,defaultValue,dirName,!disabled,#maxLength,#minLength,name,placeholder,!readOnly,!required,#rows,selectionDirection,#selectionEnd,#selectionStart,value,wrap",
  "time^[HTMLElement]|dateTime",
  "title^[HTMLElement]|text",
  "track^[HTMLElement]|!default,kind,label,src,srclang",
  "ul^[HTMLElement]|!compact,type",
  "unknown^[HTMLElement]|",
  "video^media|!disablePictureInPicture,#height,*enterpictureinpicture,*leavepictureinpicture,!playsInline,poster,#width",
  ":svg:a^:svg:graphics|",
  ":svg:animate^:svg:animation|",
  ":svg:animateMotion^:svg:animation|",
  ":svg:animateTransform^:svg:animation|",
  ":svg:circle^:svg:geometry|",
  ":svg:clipPath^:svg:graphics|",
  ":svg:defs^:svg:graphics|",
  ":svg:desc^:svg:|",
  ":svg:discard^:svg:|",
  ":svg:ellipse^:svg:geometry|",
  ":svg:feBlend^:svg:|",
  ":svg:feColorMatrix^:svg:|",
  ":svg:feComponentTransfer^:svg:|",
  ":svg:feComposite^:svg:|",
  ":svg:feConvolveMatrix^:svg:|",
  ":svg:feDiffuseLighting^:svg:|",
  ":svg:feDisplacementMap^:svg:|",
  ":svg:feDistantLight^:svg:|",
  ":svg:feDropShadow^:svg:|",
  ":svg:feFlood^:svg:|",
  ":svg:feFuncA^:svg:componentTransferFunction|",
  ":svg:feFuncB^:svg:componentTransferFunction|",
  ":svg:feFuncG^:svg:componentTransferFunction|",
  ":svg:feFuncR^:svg:componentTransferFunction|",
  ":svg:feGaussianBlur^:svg:|",
  ":svg:feImage^:svg:|",
  ":svg:feMerge^:svg:|",
  ":svg:feMergeNode^:svg:|",
  ":svg:feMorphology^:svg:|",
  ":svg:feOffset^:svg:|",
  ":svg:fePointLight^:svg:|",
  ":svg:feSpecularLighting^:svg:|",
  ":svg:feSpotLight^:svg:|",
  ":svg:feTile^:svg:|",
  ":svg:feTurbulence^:svg:|",
  ":svg:filter^:svg:|",
  ":svg:foreignObject^:svg:graphics|",
  ":svg:g^:svg:graphics|",
  ":svg:image^:svg:graphics|decoding",
  ":svg:line^:svg:geometry|",
  ":svg:linearGradient^:svg:gradient|",
  ":svg:mpath^:svg:|",
  ":svg:marker^:svg:|",
  ":svg:mask^:svg:|",
  ":svg:metadata^:svg:|",
  ":svg:path^:svg:geometry|",
  ":svg:pattern^:svg:|",
  ":svg:polygon^:svg:geometry|",
  ":svg:polyline^:svg:geometry|",
  ":svg:radialGradient^:svg:gradient|",
  ":svg:rect^:svg:geometry|",
  ":svg:svg^:svg:graphics|#currentScale,#zoomAndPan",
  ":svg:script^:svg:|type",
  ":svg:set^:svg:animation|",
  ":svg:stop^:svg:|",
  ":svg:style^:svg:|!disabled,media,title,type",
  ":svg:switch^:svg:graphics|",
  ":svg:symbol^:svg:|",
  ":svg:tspan^:svg:textPositioning|",
  ":svg:text^:svg:textPositioning|",
  ":svg:textPath^:svg:textContent|",
  ":svg:title^:svg:|",
  ":svg:use^:svg:graphics|",
  ":svg:view^:svg:|#zoomAndPan",
  "data^[HTMLElement]|value",
  "keygen^[HTMLElement]|!autofocus,challenge,!disabled,form,keytype,name",
  "menuitem^[HTMLElement]|type,label,icon,!disabled,!checked,radiogroup,!default",
  "summary^[HTMLElement]|",
  "time^[HTMLElement]|dateTime",
  ":svg:cursor^:svg:|",
  ":math:^[HTMLElement]|!autofocus,nonce,*abort,*animationend,*animationiteration,*animationstart,*auxclick,*beforeinput,*beforematch,*beforetoggle,*beforexrselect,*blur,*cancel,*canplay,*canplaythrough,*change,*click,*close,*contentvisibilityautostatechange,*contextlost,*contextmenu,*contextrestored,*copy,*cuechange,*cut,*dblclick,*drag,*dragend,*dragenter,*dragleave,*dragover,*dragstart,*drop,*durationchange,*emptied,*ended,*error,*focus,*formdata,*gotpointercapture,*input,*invalid,*keydown,*keypress,*keyup,*load,*loadeddata,*loadedmetadata,*loadstart,*lostpointercapture,*mousedown,*mouseenter,*mouseleave,*mousemove,*mouseout,*mouseover,*mouseup,*mousewheel,*paste,*pause,*play,*playing,*pointercancel,*pointerdown,*pointerenter,*pointerleave,*pointermove,*pointerout,*pointerover,*pointerrawupdate,*pointerup,*progress,*ratechange,*reset,*resize,*scroll,*scrollend,*securitypolicyviolation,*seeked,*seeking,*select,*selectionchange,*selectstart,*slotchange,*stalled,*submit,*suspend,*timeupdate,*toggle,*transitioncancel,*transitionend,*transitionrun,*transitionstart,*volumechange,*waiting,*webkitanimationend,*webkitanimationiteration,*webkitanimationstart,*webkittransitionend,*wheel,%style,#tabIndex",
  ":math:math^:math:|",
  ":math:maction^:math:|",
  ":math:menclose^:math:|",
  ":math:merror^:math:|",
  ":math:mfenced^:math:|",
  ":math:mfrac^:math:|",
  ":math:mi^:math:|",
  ":math:mmultiscripts^:math:|",
  ":math:mn^:math:|",
  ":math:mo^:math:|",
  ":math:mover^:math:|",
  ":math:mpadded^:math:|",
  ":math:mphantom^:math:|",
  ":math:mroot^:math:|",
  ":math:mrow^:math:|",
  ":math:ms^:math:|",
  ":math:mspace^:math:|",
  ":math:msqrt^:math:|",
  ":math:mstyle^:math:|",
  ":math:msub^:math:|",
  ":math:msubsup^:math:|",
  ":math:msup^:math:|",
  ":math:mtable^:math:|",
  ":math:mtd^:math:|",
  ":math:mtext^:math:|",
  ":math:mtr^:math:|",
  ":math:munder^:math:|",
  ":math:munderover^:math:|",
  ":math:semantics^:math:|"
];
const _ATTR_TO_PROP = new Map(Object.entries({
  "class": "className",
  "for": "htmlFor",
  "formaction": "formAction",
  "innerHtml": "innerHTML",
  "readonly": "readOnly",
  "tabindex": "tabIndex"
}));
const _PROP_TO_ATTR = Array.from(_ATTR_TO_PROP).reduce((inverted, [propertyName, attributeName]) => {
  inverted.set(propertyName, attributeName);
  return inverted;
}, /* @__PURE__ */ new Map());
class DomElementSchemaRegistry extends ElementSchemaRegistry {
  _schema = /* @__PURE__ */ new Map();
  // We don't allow binding to events for security reasons. Allowing event bindings would almost
  // certainly introduce bad XSS vulnerabilities. Instead, we store events in a separate schema.
  _eventSchema = /* @__PURE__ */ new Map();
  constructor() {
    super();
    SCHEMA.forEach((encodedType) => {
      const type = /* @__PURE__ */ new Map();
      const events = /* @__PURE__ */ new Set();
      const [strType, strProperties] = encodedType.split("|");
      const properties = strProperties.split(",");
      const [typeNames, superName] = strType.split("^");
      typeNames.split(",").forEach((tag) => {
        this._schema.set(tag.toLowerCase(), type);
        this._eventSchema.set(tag.toLowerCase(), events);
      });
      const superType = superName && this._schema.get(superName.toLowerCase());
      if (superType) {
        for (const [prop, value] of superType) {
          type.set(prop, value);
        }
        for (const superEvent of this._eventSchema.get(superName.toLowerCase())) {
          events.add(superEvent);
        }
      }
      properties.forEach((property2) => {
        if (property2.length > 0) {
          switch (property2[0]) {
            case "*":
              events.add(property2.substring(1));
              break;
            case "!":
              type.set(property2.substring(1), BOOLEAN);
              break;
            case "#":
              type.set(property2.substring(1), NUMBER);
              break;
            case "%":
              type.set(property2.substring(1), OBJECT);
              break;
            default:
              type.set(property2, STRING);
          }
        }
      });
    });
  }
  hasProperty(tagName, propName, schemaMetas) {
    if (schemaMetas.some((schema) => schema.name === NO_ERRORS_SCHEMA.name)) {
      return true;
    }
    if (tagName.indexOf("-") > -1) {
      if (isNgContainer(tagName) || isNgContent(tagName)) {
        return false;
      }
      if (schemaMetas.some((schema) => schema.name === CUSTOM_ELEMENTS_SCHEMA.name)) {
        return true;
      }
    }
    const elementProperties = this._schema.get(tagName.toLowerCase()) || this._schema.get("unknown");
    return elementProperties.has(propName);
  }
  hasElement(tagName, schemaMetas) {
    if (schemaMetas.some((schema) => schema.name === NO_ERRORS_SCHEMA.name)) {
      return true;
    }
    if (tagName.indexOf("-") > -1) {
      if (isNgContainer(tagName) || isNgContent(tagName)) {
        return true;
      }
      if (schemaMetas.some((schema) => schema.name === CUSTOM_ELEMENTS_SCHEMA.name)) {
        return true;
      }
    }
    return this._schema.has(tagName.toLowerCase());
  }
  /**
   * securityContext returns the security context for the given property on the given DOM tag.
   *
   * Tag and property name are statically known and cannot change at runtime, i.e. it is not
   * possible to bind a value into a changing attribute or tag name.
   *
   * The filtering is based on a list of allowed tags|attributes. All attributes in the schema
   * above are assumed to have the 'NONE' security context, i.e. that they are safe inert
   * string values. Only specific well known attack vectors are assigned their appropriate context.
   */
  securityContext(tagName, propName, isAttribute) {
    if (isAttribute) {
      propName = this.getMappedPropName(propName);
    }
    tagName = tagName.toLowerCase();
    propName = propName.toLowerCase();
    let ctx = SECURITY_SCHEMA()[tagName + "|" + propName];
    if (ctx) {
      return ctx;
    }
    ctx = SECURITY_SCHEMA()["*|" + propName];
    return ctx ? ctx : SecurityContext.NONE;
  }
  getMappedPropName(propName) {
    return _ATTR_TO_PROP.get(propName) ?? propName;
  }
  getDefaultComponentElementName() {
    return "ng-component";
  }
  validateProperty(name) {
    if (name.toLowerCase().startsWith("on")) {
      const msg = `Binding to event property '${name}' is disallowed for security reasons, please use (${name.slice(2)})=...
If '${name}' is a directive input, make sure the directive is imported by the current module.`;
      return { error: true, msg };
    } else {
      return { error: false };
    }
  }
  validateAttribute(name) {
    if (name.toLowerCase().startsWith("on")) {
      const msg = `Binding to event attribute '${name}' is disallowed for security reasons, please use (${name.slice(2)})=...`;
      return { error: true, msg };
    } else {
      return { error: false };
    }
  }
  allKnownElementNames() {
    return Array.from(this._schema.keys());
  }
  allKnownAttributesOfElement(tagName) {
    const elementProperties = this._schema.get(tagName.toLowerCase()) || this._schema.get("unknown");
    return Array.from(elementProperties.keys()).map((prop) => _PROP_TO_ATTR.get(prop) ?? prop);
  }
  allKnownEventsOfElement(tagName) {
    return Array.from(this._eventSchema.get(tagName.toLowerCase()) ?? []);
  }
  normalizeAnimationStyleProperty(propName) {
    return dashCaseToCamelCase(propName);
  }
  normalizeAnimationStyleValue(camelCaseProp, userProvidedProp, val) {
    let unit = "";
    const strVal = val.toString().trim();
    let errorMsg = null;
    if (_isPixelDimensionStyle(camelCaseProp) && val !== 0 && val !== "0") {
      if (typeof val === "number") {
        unit = "px";
      } else {
        const valAndSuffixMatch = val.match(/^[+-]?[\d\.]+([a-z]*)$/);
        if (valAndSuffixMatch && valAndSuffixMatch[1].length == 0) {
          errorMsg = `Please provide a CSS unit value for ${userProvidedProp}:${val}`;
        }
      }
    }
    return { error: errorMsg, value: strVal + unit };
  }
}
function _isPixelDimensionStyle(prop) {
  switch (prop) {
    case "width":
    case "height":
    case "minWidth":
    case "minHeight":
    case "maxWidth":
    case "maxHeight":
    case "left":
    case "top":
    case "bottom":
    case "right":
    case "fontSize":
    case "outlineWidth":
    case "outlineOffset":
    case "paddingTop":
    case "paddingLeft":
    case "paddingBottom":
    case "paddingRight":
    case "marginTop":
    case "marginLeft":
    case "marginBottom":
    case "marginRight":
    case "borderRadius":
    case "borderWidth":
    case "borderTopWidth":
    case "borderLeftWidth":
    case "borderRightWidth":
    case "borderBottomWidth":
    case "textIndent":
      return true;
    default:
      return false;
  }
}
class HtmlTagDefinition {
  closedByChildren = {};
  contentType;
  closedByParent = false;
  implicitNamespacePrefix;
  isVoid;
  ignoreFirstLf;
  canSelfClose;
  preventNamespaceInheritance;
  constructor({ closedByChildren, implicitNamespacePrefix, contentType = TagContentType.PARSABLE_DATA, closedByParent = false, isVoid = false, ignoreFirstLf = false, preventNamespaceInheritance = false, canSelfClose = false } = {}) {
    if (closedByChildren && closedByChildren.length > 0) {
      closedByChildren.forEach((tagName) => this.closedByChildren[tagName] = true);
    }
    this.isVoid = isVoid;
    this.closedByParent = closedByParent || isVoid;
    this.implicitNamespacePrefix = implicitNamespacePrefix || null;
    this.contentType = contentType;
    this.ignoreFirstLf = ignoreFirstLf;
    this.preventNamespaceInheritance = preventNamespaceInheritance;
    this.canSelfClose = canSelfClose ?? isVoid;
  }
  isClosedByChild(name) {
    return this.isVoid || name.toLowerCase() in this.closedByChildren;
  }
  getContentType(prefix) {
    if (typeof this.contentType === "object") {
      const overrideType = prefix === void 0 ? void 0 : this.contentType[prefix];
      return overrideType ?? this.contentType.default;
    }
    return this.contentType;
  }
}
let DEFAULT_TAG_DEFINITION;
let TAG_DEFINITIONS;
function getHtmlTagDefinition(tagName) {
  if (!TAG_DEFINITIONS) {
    DEFAULT_TAG_DEFINITION = new HtmlTagDefinition({ canSelfClose: true });
    TAG_DEFINITIONS = Object.assign(/* @__PURE__ */ Object.create(null), {
      "base": new HtmlTagDefinition({ isVoid: true }),
      "meta": new HtmlTagDefinition({ isVoid: true }),
      "area": new HtmlTagDefinition({ isVoid: true }),
      "embed": new HtmlTagDefinition({ isVoid: true }),
      "link": new HtmlTagDefinition({ isVoid: true }),
      "img": new HtmlTagDefinition({ isVoid: true }),
      "input": new HtmlTagDefinition({ isVoid: true }),
      "param": new HtmlTagDefinition({ isVoid: true }),
      "hr": new HtmlTagDefinition({ isVoid: true }),
      "br": new HtmlTagDefinition({ isVoid: true }),
      "source": new HtmlTagDefinition({ isVoid: true }),
      "track": new HtmlTagDefinition({ isVoid: true }),
      "wbr": new HtmlTagDefinition({ isVoid: true }),
      "p": new HtmlTagDefinition({
        closedByChildren: [
          "address",
          "article",
          "aside",
          "blockquote",
          "div",
          "dl",
          "fieldset",
          "footer",
          "form",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "header",
          "hgroup",
          "hr",
          "main",
          "nav",
          "ol",
          "p",
          "pre",
          "section",
          "table",
          "ul"
        ],
        closedByParent: true
      }),
      "thead": new HtmlTagDefinition({ closedByChildren: ["tbody", "tfoot"] }),
      "tbody": new HtmlTagDefinition({ closedByChildren: ["tbody", "tfoot"], closedByParent: true }),
      "tfoot": new HtmlTagDefinition({ closedByChildren: ["tbody"], closedByParent: true }),
      "tr": new HtmlTagDefinition({ closedByChildren: ["tr"], closedByParent: true }),
      "td": new HtmlTagDefinition({ closedByChildren: ["td", "th"], closedByParent: true }),
      "th": new HtmlTagDefinition({ closedByChildren: ["td", "th"], closedByParent: true }),
      "col": new HtmlTagDefinition({ isVoid: true }),
      "svg": new HtmlTagDefinition({ implicitNamespacePrefix: "svg" }),
      "foreignObject": new HtmlTagDefinition({
        // Usually the implicit namespace here would be redundant since it will be inherited from
        // the parent `svg`, but we have to do it for `foreignObject`, because the way the parser
        // works is that the parent node of an end tag is its own start tag which means that
        // the `preventNamespaceInheritance` on `foreignObject` would have it default to the
        // implicit namespace which is `html`, unless specified otherwise.
        implicitNamespacePrefix: "svg",
        // We want to prevent children of foreignObject from inheriting its namespace, because
        // the point of the element is to allow nodes from other namespaces to be inserted.
        preventNamespaceInheritance: true
      }),
      "math": new HtmlTagDefinition({ implicitNamespacePrefix: "math" }),
      "li": new HtmlTagDefinition({ closedByChildren: ["li"], closedByParent: true }),
      "dt": new HtmlTagDefinition({ closedByChildren: ["dt", "dd"] }),
      "dd": new HtmlTagDefinition({ closedByChildren: ["dt", "dd"], closedByParent: true }),
      "rb": new HtmlTagDefinition({
        closedByChildren: ["rb", "rt", "rtc", "rp"],
        closedByParent: true
      }),
      "rt": new HtmlTagDefinition({
        closedByChildren: ["rb", "rt", "rtc", "rp"],
        closedByParent: true
      }),
      "rtc": new HtmlTagDefinition({ closedByChildren: ["rb", "rtc", "rp"], closedByParent: true }),
      "rp": new HtmlTagDefinition({
        closedByChildren: ["rb", "rt", "rtc", "rp"],
        closedByParent: true
      }),
      "optgroup": new HtmlTagDefinition({ closedByChildren: ["optgroup"], closedByParent: true }),
      "option": new HtmlTagDefinition({
        closedByChildren: ["option", "optgroup"],
        closedByParent: true
      }),
      "pre": new HtmlTagDefinition({ ignoreFirstLf: true }),
      "listing": new HtmlTagDefinition({ ignoreFirstLf: true }),
      "style": new HtmlTagDefinition({ contentType: TagContentType.RAW_TEXT }),
      "script": new HtmlTagDefinition({ contentType: TagContentType.RAW_TEXT }),
      "title": new HtmlTagDefinition({
        // The browser supports two separate `title` tags which have to use
        // a different content type: `HTMLTitleElement` and `SVGTitleElement`
        contentType: {
          default: TagContentType.ESCAPABLE_RAW_TEXT,
          svg: TagContentType.PARSABLE_DATA
        }
      }),
      "textarea": new HtmlTagDefinition({
        contentType: TagContentType.ESCAPABLE_RAW_TEXT,
        ignoreFirstLf: true
      })
    });
    new DomElementSchemaRegistry().allKnownElementNames().forEach((knownTagName) => {
      if (!TAG_DEFINITIONS[knownTagName] && getNsPrefix(knownTagName) === null) {
        TAG_DEFINITIONS[knownTagName] = new HtmlTagDefinition({ canSelfClose: false });
      }
    });
  }
  return TAG_DEFINITIONS[tagName] ?? TAG_DEFINITIONS[tagName.toLowerCase()] ?? DEFAULT_TAG_DEFINITION;
}
const TAG_TO_PLACEHOLDER_NAMES = {
  "A": "LINK",
  "B": "BOLD_TEXT",
  "BR": "LINE_BREAK",
  "EM": "EMPHASISED_TEXT",
  "H1": "HEADING_LEVEL1",
  "H2": "HEADING_LEVEL2",
  "H3": "HEADING_LEVEL3",
  "H4": "HEADING_LEVEL4",
  "H5": "HEADING_LEVEL5",
  "H6": "HEADING_LEVEL6",
  "HR": "HORIZONTAL_RULE",
  "I": "ITALIC_TEXT",
  "LI": "LIST_ITEM",
  "LINK": "MEDIA_LINK",
  "OL": "ORDERED_LIST",
  "P": "PARAGRAPH",
  "Q": "QUOTATION",
  "S": "STRIKETHROUGH_TEXT",
  "SMALL": "SMALL_TEXT",
  "SUB": "SUBSTRIPT",
  "SUP": "SUPERSCRIPT",
  "TBODY": "TABLE_BODY",
  "TD": "TABLE_CELL",
  "TFOOT": "TABLE_FOOTER",
  "TH": "TABLE_HEADER_CELL",
  "THEAD": "TABLE_HEADER",
  "TR": "TABLE_ROW",
  "TT": "MONOSPACED_TEXT",
  "U": "UNDERLINED_TEXT",
  "UL": "UNORDERED_LIST"
};
class PlaceholderRegistry {
  // Count the occurrence of the base name top generate a unique name
  _placeHolderNameCounts = {};
  // Maps signature to placeholder names
  _signatureToName = {};
  getStartTagPlaceholderName(tag, attrs, isVoid) {
    const signature = this._hashTag(tag, attrs, isVoid);
    if (this._signatureToName[signature]) {
      return this._signatureToName[signature];
    }
    const upperTag = tag.toUpperCase();
    const baseName = TAG_TO_PLACEHOLDER_NAMES[upperTag] || `TAG_${upperTag}`;
    const name = this._generateUniqueName(isVoid ? baseName : `START_${baseName}`);
    this._signatureToName[signature] = name;
    return name;
  }
  getCloseTagPlaceholderName(tag) {
    const signature = this._hashClosingTag(tag);
    if (this._signatureToName[signature]) {
      return this._signatureToName[signature];
    }
    const upperTag = tag.toUpperCase();
    const baseName = TAG_TO_PLACEHOLDER_NAMES[upperTag] || `TAG_${upperTag}`;
    const name = this._generateUniqueName(`CLOSE_${baseName}`);
    this._signatureToName[signature] = name;
    return name;
  }
  getPlaceholderName(name, content) {
    const upperName = name.toUpperCase();
    const signature = `PH: ${upperName}=${content}`;
    if (this._signatureToName[signature]) {
      return this._signatureToName[signature];
    }
    const uniqueName = this._generateUniqueName(upperName);
    this._signatureToName[signature] = uniqueName;
    return uniqueName;
  }
  getUniquePlaceholder(name) {
    return this._generateUniqueName(name.toUpperCase());
  }
  getStartBlockPlaceholderName(name, parameters) {
    const signature = this._hashBlock(name, parameters);
    if (this._signatureToName[signature]) {
      return this._signatureToName[signature];
    }
    const placeholder = this._generateUniqueName(`START_BLOCK_${this._toSnakeCase(name)}`);
    this._signatureToName[signature] = placeholder;
    return placeholder;
  }
  getCloseBlockPlaceholderName(name) {
    const signature = this._hashClosingBlock(name);
    if (this._signatureToName[signature]) {
      return this._signatureToName[signature];
    }
    const placeholder = this._generateUniqueName(`CLOSE_BLOCK_${this._toSnakeCase(name)}`);
    this._signatureToName[signature] = placeholder;
    return placeholder;
  }
  // Generate a hash for a tag - does not take attribute order into account
  _hashTag(tag, attrs, isVoid) {
    const start = `<${tag}`;
    const strAttrs = Object.keys(attrs).sort().map((name) => ` ${name}=${attrs[name]}`).join("");
    const end = isVoid ? "/>" : `></${tag}>`;
    return start + strAttrs + end;
  }
  _hashClosingTag(tag) {
    return this._hashTag(`/${tag}`, {}, false);
  }
  _hashBlock(name, parameters) {
    const params = parameters.length === 0 ? "" : ` (${parameters.sort().join("; ")})`;
    return `@${name}${params} {}`;
  }
  _hashClosingBlock(name) {
    return this._hashBlock(`close_${name}`, []);
  }
  _toSnakeCase(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  }
  _generateUniqueName(base) {
    const seen = this._placeHolderNameCounts.hasOwnProperty(base);
    if (!seen) {
      this._placeHolderNameCounts[base] = 1;
      return base;
    }
    const id = this._placeHolderNameCounts[base];
    this._placeHolderNameCounts[base] = id + 1;
    return `${base}_${id}`;
  }
}
const _expParser = new Parser(new Lexer());
function createI18nMessageFactory(interpolationConfig, containerBlocks, retainEmptyTokens, preserveExpressionWhitespace) {
  const visitor = new _I18nVisitor(_expParser, interpolationConfig, containerBlocks, retainEmptyTokens, preserveExpressionWhitespace);
  return (nodes, meaning, description, customId, visitNodeFn) => visitor.toI18nMessage(nodes, meaning, description, customId, visitNodeFn);
}
function noopVisitNodeFn(_html, i18n2) {
  return i18n2;
}
class _I18nVisitor {
  _expressionParser;
  _interpolationConfig;
  _containerBlocks;
  _retainEmptyTokens;
  _preserveExpressionWhitespace;
  constructor(_expressionParser, _interpolationConfig, _containerBlocks, _retainEmptyTokens, _preserveExpressionWhitespace) {
    this._expressionParser = _expressionParser;
    this._interpolationConfig = _interpolationConfig;
    this._containerBlocks = _containerBlocks;
    this._retainEmptyTokens = _retainEmptyTokens;
    this._preserveExpressionWhitespace = _preserveExpressionWhitespace;
  }
  toI18nMessage(nodes, meaning = "", description = "", customId = "", visitNodeFn) {
    const context = {
      isIcu: nodes.length == 1 && nodes[0] instanceof Expansion,
      icuDepth: 0,
      placeholderRegistry: new PlaceholderRegistry(),
      placeholderToContent: {},
      placeholderToMessage: {},
      visitNodeFn: visitNodeFn || noopVisitNodeFn
    };
    const i18nodes = visitAll(this, nodes, context);
    return new Message(i18nodes, context.placeholderToContent, context.placeholderToMessage, meaning, description, customId);
  }
  visitElement(el, context) {
    const children = visitAll(this, el.children, context);
    const attrs = {};
    el.attrs.forEach((attr) => {
      attrs[attr.name] = attr.value;
    });
    const isVoid = getHtmlTagDefinition(el.name).isVoid;
    const startPhName = context.placeholderRegistry.getStartTagPlaceholderName(el.name, attrs, isVoid);
    context.placeholderToContent[startPhName] = {
      text: el.startSourceSpan.toString(),
      sourceSpan: el.startSourceSpan
    };
    let closePhName = "";
    if (!isVoid) {
      closePhName = context.placeholderRegistry.getCloseTagPlaceholderName(el.name);
      context.placeholderToContent[closePhName] = {
        text: `</${el.name}>`,
        sourceSpan: el.endSourceSpan ?? el.sourceSpan
      };
    }
    const node = new TagPlaceholder(el.name, attrs, startPhName, closePhName, children, isVoid, el.sourceSpan, el.startSourceSpan, el.endSourceSpan);
    return context.visitNodeFn(el, node);
  }
  visitAttribute(attribute2, context) {
    const node = attribute2.valueTokens === void 0 || attribute2.valueTokens.length === 1 ? new Text$2(attribute2.value, attribute2.valueSpan || attribute2.sourceSpan) : this._visitTextWithInterpolation(attribute2.valueTokens, attribute2.valueSpan || attribute2.sourceSpan, context, attribute2.i18n);
    return context.visitNodeFn(attribute2, node);
  }
  visitText(text2, context) {
    const node = text2.tokens.length === 1 ? new Text$2(text2.value, text2.sourceSpan) : this._visitTextWithInterpolation(text2.tokens, text2.sourceSpan, context, text2.i18n);
    return context.visitNodeFn(text2, node);
  }
  visitComment(comment, context) {
    return null;
  }
  visitExpansion(icu, context) {
    context.icuDepth++;
    const i18nIcuCases = {};
    const i18nIcu = new Icu(icu.switchValue, icu.type, i18nIcuCases, icu.sourceSpan);
    icu.cases.forEach((caze) => {
      i18nIcuCases[caze.value] = new Container(caze.expression.map((node2) => node2.visit(this, context)), caze.expSourceSpan);
    });
    context.icuDepth--;
    if (context.isIcu || context.icuDepth > 0) {
      const expPh = context.placeholderRegistry.getUniquePlaceholder(`VAR_${icu.type}`);
      i18nIcu.expressionPlaceholder = expPh;
      context.placeholderToContent[expPh] = {
        text: icu.switchValue,
        sourceSpan: icu.switchValueSourceSpan
      };
      return context.visitNodeFn(icu, i18nIcu);
    }
    const phName = context.placeholderRegistry.getPlaceholderName("ICU", icu.sourceSpan.toString());
    context.placeholderToMessage[phName] = this.toI18nMessage([icu], "", "", "", void 0);
    const node = new IcuPlaceholder(i18nIcu, phName, icu.sourceSpan);
    return context.visitNodeFn(icu, node);
  }
  visitExpansionCase(_icuCase, _context) {
    throw new Error("Unreachable code");
  }
  visitBlock(block, context) {
    const children = visitAll(this, block.children, context);
    if (this._containerBlocks.has(block.name)) {
      return new Container(children, block.sourceSpan);
    }
    const parameters = block.parameters.map((param) => param.expression);
    const startPhName = context.placeholderRegistry.getStartBlockPlaceholderName(block.name, parameters);
    const closePhName = context.placeholderRegistry.getCloseBlockPlaceholderName(block.name);
    context.placeholderToContent[startPhName] = {
      text: block.startSourceSpan.toString(),
      sourceSpan: block.startSourceSpan
    };
    context.placeholderToContent[closePhName] = {
      text: block.endSourceSpan ? block.endSourceSpan.toString() : "}",
      sourceSpan: block.endSourceSpan ?? block.sourceSpan
    };
    const node = new BlockPlaceholder(block.name, parameters, startPhName, closePhName, children, block.sourceSpan, block.startSourceSpan, block.endSourceSpan);
    return context.visitNodeFn(block, node);
  }
  visitBlockParameter(_parameter, _context) {
    throw new Error("Unreachable code");
  }
  visitLetDeclaration(decl, context) {
    return null;
  }
  /**
   * Convert, text and interpolated tokens up into text and placeholder pieces.
   *
   * @param tokens The text and interpolated tokens.
   * @param sourceSpan The span of the whole of the `text` string.
   * @param context The current context of the visitor, used to compute and store placeholders.
   * @param previousI18n Any i18n metadata associated with this `text` from a previous pass.
   */
  _visitTextWithInterpolation(tokens, sourceSpan, context, previousI18n) {
    const nodes = [];
    let hasInterpolation = false;
    for (const token of tokens) {
      switch (token.type) {
        case 8:
        case 17:
          hasInterpolation = true;
          const [startMarker, expression, endMarker] = token.parts;
          const baseName = extractPlaceholderName(expression) || "INTERPOLATION";
          const phName = context.placeholderRegistry.getPlaceholderName(baseName, expression);
          if (this._preserveExpressionWhitespace) {
            context.placeholderToContent[phName] = {
              text: token.parts.join(""),
              sourceSpan: token.sourceSpan
            };
            nodes.push(new Placeholder(expression, phName, token.sourceSpan));
          } else {
            const normalized = this.normalizeExpression(token);
            context.placeholderToContent[phName] = {
              text: `${startMarker}${normalized}${endMarker}`,
              sourceSpan: token.sourceSpan
            };
            nodes.push(new Placeholder(normalized, phName, token.sourceSpan));
          }
          break;
        default:
          if (token.parts[0].length > 0 || this._retainEmptyTokens) {
            const previous = nodes[nodes.length - 1];
            if (previous instanceof Text$2) {
              previous.value += token.parts[0];
              previous.sourceSpan = new ParseSourceSpan(previous.sourceSpan.start, token.sourceSpan.end, previous.sourceSpan.fullStart, previous.sourceSpan.details);
            } else {
              nodes.push(new Text$2(token.parts[0], token.sourceSpan));
            }
          } else {
            if (this._retainEmptyTokens) {
              nodes.push(new Text$2(token.parts[0], token.sourceSpan));
            }
          }
          break;
      }
    }
    if (hasInterpolation) {
      reusePreviousSourceSpans(nodes, previousI18n);
      return new Container(nodes, sourceSpan);
    } else {
      return nodes[0];
    }
  }
  // Normalize expression whitespace by parsing and re-serializing it. This makes
  // message IDs more durable to insignificant whitespace changes.
  normalizeExpression(token) {
    const expression = token.parts[1];
    const expr = this._expressionParser.parseBinding(
      expression,
      /* location */
      token.sourceSpan.start.toString(),
      /* absoluteOffset */
      token.sourceSpan.start.offset,
      this._interpolationConfig
    );
    return serialize(expr);
  }
}
function reusePreviousSourceSpans(nodes, previousI18n) {
  if (previousI18n instanceof Message) {
    assertSingleContainerMessage(previousI18n);
    previousI18n = previousI18n.nodes[0];
  }
  if (previousI18n instanceof Container) {
    assertEquivalentNodes(previousI18n.children, nodes);
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].sourceSpan = previousI18n.children[i].sourceSpan;
    }
  }
}
function assertSingleContainerMessage(message) {
  const nodes = message.nodes;
  if (nodes.length !== 1 || !(nodes[0] instanceof Container)) {
    throw new Error("Unexpected previous i18n message - expected it to consist of only a single `Container` node.");
  }
}
function assertEquivalentNodes(previousNodes, nodes) {
  if (previousNodes.length !== nodes.length) {
    throw new Error(`
The number of i18n message children changed between first and second pass.

First pass (${previousNodes.length} tokens):
${previousNodes.map((node) => `"${node.sourceSpan.toString()}"`).join("\n")}

Second pass (${nodes.length} tokens):
${nodes.map((node) => `"${node.sourceSpan.toString()}"`).join("\n")}
    `.trim());
  }
  if (previousNodes.some((node, i) => nodes[i].constructor !== node.constructor)) {
    throw new Error("The types of the i18n message children changed between first and second pass.");
  }
}
const _CUSTOM_PH_EXP = /\/\/[\s\S]*i18n[\s\S]*\([\s\S]*ph[\s\S]*=[\s\S]*("|')([\s\S]*?)\1[\s\S]*\)/g;
function extractPlaceholderName(input) {
  return input.split(_CUSTOM_PH_EXP)[2];
}
class I18nError extends ParseError {
  constructor(span, msg) {
    super(span, msg);
  }
}
const TRUSTED_TYPES_SINKS = /* @__PURE__ */ new Set([
  // NOTE: All strings in this set *must* be lowercase!
  // TrustedHTML
  "iframe|srcdoc",
  "*|innerhtml",
  "*|outerhtml",
  // NB: no TrustedScript here, as the corresponding tags are stripped by the compiler.
  // TrustedScriptURL
  "embed|src",
  "object|codebase",
  "object|data"
]);
function isTrustedTypesSink(tagName, propName) {
  tagName = tagName.toLowerCase();
  propName = propName.toLowerCase();
  return TRUSTED_TYPES_SINKS.has(tagName + "|" + propName) || TRUSTED_TYPES_SINKS.has("*|" + propName);
}
const setI18nRefs = (originalNodeMap) => {
  return (trimmedNode, i18nNode) => {
    const originalNode = originalNodeMap.get(trimmedNode) ?? trimmedNode;
    if (originalNode instanceof NodeWithI18n) {
      if (i18nNode instanceof IcuPlaceholder && originalNode.i18n instanceof Message) {
        i18nNode.previousMessage = originalNode.i18n;
      }
      originalNode.i18n = i18nNode;
    }
    return i18nNode;
  };
};
class I18nMetaVisitor {
  interpolationConfig;
  keepI18nAttrs;
  enableI18nLegacyMessageIdFormat;
  containerBlocks;
  preserveSignificantWhitespace;
  retainEmptyTokens;
  // whether visited nodes contain i18n information
  hasI18nMeta = false;
  _errors = [];
  constructor(interpolationConfig = DEFAULT_INTERPOLATION_CONFIG, keepI18nAttrs = false, enableI18nLegacyMessageIdFormat = false, containerBlocks = DEFAULT_CONTAINER_BLOCKS, preserveSignificantWhitespace = true, retainEmptyTokens = !preserveSignificantWhitespace) {
    this.interpolationConfig = interpolationConfig;
    this.keepI18nAttrs = keepI18nAttrs;
    this.enableI18nLegacyMessageIdFormat = enableI18nLegacyMessageIdFormat;
    this.containerBlocks = containerBlocks;
    this.preserveSignificantWhitespace = preserveSignificantWhitespace;
    this.retainEmptyTokens = retainEmptyTokens;
  }
  _generateI18nMessage(nodes, meta = "", visitNodeFn) {
    const { meaning, description, customId } = this._parseMetadata(meta);
    const createI18nMessage2 = createI18nMessageFactory(
      this.interpolationConfig,
      this.containerBlocks,
      this.retainEmptyTokens,
      /* preserveExpressionWhitespace */
      this.preserveSignificantWhitespace
    );
    const message = createI18nMessage2(nodes, meaning, description, customId, visitNodeFn);
    this._setMessageId(message, meta);
    this._setLegacyIds(message, meta);
    return message;
  }
  visitAllWithErrors(nodes) {
    const result = nodes.map((node) => node.visit(this, null));
    return new ParseTreeResult(result, this._errors);
  }
  visitElement(element2) {
    let message = void 0;
    if (hasI18nAttrs(element2)) {
      this.hasI18nMeta = true;
      const attrs = [];
      const attrsMeta = {};
      for (const attr of element2.attrs) {
        if (attr.name === I18N_ATTR) {
          const i18n2 = element2.i18n || attr.value;
          const originalNodeMap = /* @__PURE__ */ new Map();
          const trimmedNodes = this.preserveSignificantWhitespace ? element2.children : visitAllWithSiblings(new WhitespaceVisitor(false, originalNodeMap), element2.children);
          message = this._generateI18nMessage(trimmedNodes, i18n2, setI18nRefs(originalNodeMap));
          if (message.nodes.length === 0) {
            message = void 0;
          }
          element2.i18n = message;
        } else if (attr.name.startsWith(I18N_ATTR_PREFIX)) {
          const name = attr.name.slice(I18N_ATTR_PREFIX.length);
          if (isTrustedTypesSink(element2.name, name)) {
            this._reportError(attr, `Translating attribute '${name}' is disallowed for security reasons.`);
          } else {
            attrsMeta[name] = attr.value;
          }
        } else {
          attrs.push(attr);
        }
      }
      if (Object.keys(attrsMeta).length) {
        for (const attr of attrs) {
          const meta = attrsMeta[attr.name];
          if (meta !== void 0 && attr.value) {
            attr.i18n = this._generateI18nMessage([attr], attr.i18n || meta);
          }
        }
      }
      if (!this.keepI18nAttrs) {
        element2.attrs = attrs;
      }
    }
    visitAll(this, element2.children, message);
    return element2;
  }
  visitExpansion(expansion, currentMessage) {
    let message;
    const meta = expansion.i18n;
    this.hasI18nMeta = true;
    if (meta instanceof IcuPlaceholder) {
      const name = meta.name;
      message = this._generateI18nMessage([expansion], meta);
      const icu = icuFromI18nMessage(message);
      icu.name = name;
      if (currentMessage !== null) {
        currentMessage.placeholderToMessage[name] = message;
      }
    } else {
      message = this._generateI18nMessage([expansion], currentMessage || meta);
    }
    expansion.i18n = message;
    return expansion;
  }
  visitText(text2) {
    return text2;
  }
  visitAttribute(attribute2) {
    return attribute2;
  }
  visitComment(comment) {
    return comment;
  }
  visitExpansionCase(expansionCase) {
    return expansionCase;
  }
  visitBlock(block, context) {
    visitAll(this, block.children, context);
    return block;
  }
  visitBlockParameter(parameter, context) {
    return parameter;
  }
  visitLetDeclaration(decl, context) {
    return decl;
  }
  /**
   * Parse the general form `meta` passed into extract the explicit metadata needed to create a
   * `Message`.
   *
   * There are three possibilities for the `meta` variable
   * 1) a string from an `i18n` template attribute: parse it to extract the metadata values.
   * 2) a `Message` from a previous processing pass: reuse the metadata values in the message.
   * 4) other: ignore this and just process the message metadata as normal
   *
   * @param meta the bucket that holds information about the message
   * @returns the parsed metadata.
   */
  _parseMetadata(meta) {
    return typeof meta === "string" ? parseI18nMeta(meta) : meta instanceof Message ? meta : {};
  }
  /**
   * Generate (or restore) message id if not specified already.
   */
  _setMessageId(message, meta) {
    if (!message.id) {
      message.id = meta instanceof Message && meta.id || decimalDigest(message);
    }
  }
  /**
   * Update the `message` with a `legacyId` if necessary.
   *
   * @param message the message whose legacy id should be set
   * @param meta information about the message being processed
   */
  _setLegacyIds(message, meta) {
    if (this.enableI18nLegacyMessageIdFormat) {
      message.legacyIds = [computeDigest(message), computeDecimalDigest(message)];
    } else if (typeof meta !== "string") {
      const previousMessage = meta instanceof Message ? meta : meta instanceof IcuPlaceholder ? meta.previousMessage : void 0;
      message.legacyIds = previousMessage ? previousMessage.legacyIds : [];
    }
  }
  _reportError(node, msg) {
    this._errors.push(new I18nError(node.sourceSpan, msg));
  }
}
const I18N_MEANING_SEPARATOR = "|";
const I18N_ID_SEPARATOR = "@@";
function parseI18nMeta(meta = "") {
  let customId;
  let meaning;
  let description;
  meta = meta.trim();
  if (meta) {
    const idIndex = meta.indexOf(I18N_ID_SEPARATOR);
    const descIndex = meta.indexOf(I18N_MEANING_SEPARATOR);
    let meaningAndDesc;
    [meaningAndDesc, customId] = idIndex > -1 ? [meta.slice(0, idIndex), meta.slice(idIndex + 2)] : [meta, ""];
    [meaning, description] = descIndex > -1 ? [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] : ["", meaningAndDesc];
  }
  return { customId, meaning, description };
}
function i18nMetaToJSDoc(meta) {
  const tags = [];
  if (meta.description) {
    tags.push({ tagName: "desc", text: meta.description });
  } else {
    tags.push({ tagName: "suppress", text: "{msgDescriptions}" });
  }
  if (meta.meaning) {
    tags.push({ tagName: "meaning", text: meta.meaning });
  }
  return jsDocComment(tags);
}
const GOOG_GET_MSG = "goog.getMsg";
function createGoogleGetMsgStatements(variable$1, message, closureVar, placeholderValues) {
  const messageString = serializeI18nMessageForGetMsg(message);
  const args = [literal(messageString)];
  if (Object.keys(placeholderValues).length) {
    args.push(mapLiteral(
      formatI18nPlaceholderNamesInMap(
        placeholderValues,
        true
        /* useCamelCase */
      ),
      true
      /* quoted */
    ));
    args.push(mapLiteral({
      original_code: literalMap(Object.keys(placeholderValues).map((param) => ({
        key: formatI18nPlaceholderName(param),
        quoted: true,
        value: message.placeholders[param] ? (
          // Get source span for typical placeholder if it exists.
          literal(message.placeholders[param].sourceSpan.toString())
        ) : (
          // Otherwise must be an ICU expression, get it's source span.
          literal(message.placeholderToMessage[param].nodes.map((node) => node.sourceSpan.toString()).join(""))
        )
      })))
    }));
  }
  const googGetMsgStmt = closureVar.set(variable(GOOG_GET_MSG).callFn(args)).toConstDecl();
  googGetMsgStmt.addLeadingComment(i18nMetaToJSDoc(message));
  const i18nAssignmentStmt = new ExpressionStatement(variable$1.set(closureVar));
  return [googGetMsgStmt, i18nAssignmentStmt];
}
class GetMsgSerializerVisitor {
  formatPh(value) {
    return `{$${formatI18nPlaceholderName(value)}}`;
  }
  visitText(text2) {
    return text2.value;
  }
  visitContainer(container) {
    return container.children.map((child) => child.visit(this)).join("");
  }
  visitIcu(icu) {
    return serializeIcuNode(icu);
  }
  visitTagPlaceholder(ph) {
    return ph.isVoid ? this.formatPh(ph.startName) : `${this.formatPh(ph.startName)}${ph.children.map((child) => child.visit(this)).join("")}${this.formatPh(ph.closeName)}`;
  }
  visitPlaceholder(ph) {
    return this.formatPh(ph.name);
  }
  visitBlockPlaceholder(ph) {
    return `${this.formatPh(ph.startName)}${ph.children.map((child) => child.visit(this)).join("")}${this.formatPh(ph.closeName)}`;
  }
  visitIcuPlaceholder(ph, context) {
    return this.formatPh(ph.name);
  }
}
const serializerVisitor = new GetMsgSerializerVisitor();
function serializeI18nMessageForGetMsg(message) {
  return message.nodes.map((node) => node.visit(serializerVisitor, null)).join("");
}
function createLocalizeStatements(variable2, message, params) {
  const { messageParts, placeHolders } = serializeI18nMessageForLocalize(message);
  const sourceSpan = getSourceSpan(message);
  const expressions = placeHolders.map((ph) => params[ph.text]);
  const localizedString$1 = localizedString(message, messageParts, placeHolders, expressions, sourceSpan);
  const variableInitialization = variable2.set(localizedString$1);
  return [new ExpressionStatement(variableInitialization)];
}
class LocalizeSerializerVisitor {
  placeholderToMessage;
  pieces;
  constructor(placeholderToMessage, pieces) {
    this.placeholderToMessage = placeholderToMessage;
    this.pieces = pieces;
  }
  visitText(text2) {
    if (this.pieces[this.pieces.length - 1] instanceof LiteralPiece) {
      this.pieces[this.pieces.length - 1].text += text2.value;
    } else {
      const sourceSpan = new ParseSourceSpan(text2.sourceSpan.fullStart, text2.sourceSpan.end, text2.sourceSpan.fullStart, text2.sourceSpan.details);
      this.pieces.push(new LiteralPiece(text2.value, sourceSpan));
    }
  }
  visitContainer(container) {
    container.children.forEach((child) => child.visit(this));
  }
  visitIcu(icu) {
    this.pieces.push(new LiteralPiece(serializeIcuNode(icu), icu.sourceSpan));
  }
  visitTagPlaceholder(ph) {
    this.pieces.push(this.createPlaceholderPiece(ph.startName, ph.startSourceSpan ?? ph.sourceSpan));
    if (!ph.isVoid) {
      ph.children.forEach((child) => child.visit(this));
      this.pieces.push(this.createPlaceholderPiece(ph.closeName, ph.endSourceSpan ?? ph.sourceSpan));
    }
  }
  visitPlaceholder(ph) {
    this.pieces.push(this.createPlaceholderPiece(ph.name, ph.sourceSpan));
  }
  visitBlockPlaceholder(ph) {
    this.pieces.push(this.createPlaceholderPiece(ph.startName, ph.startSourceSpan ?? ph.sourceSpan));
    ph.children.forEach((child) => child.visit(this));
    this.pieces.push(this.createPlaceholderPiece(ph.closeName, ph.endSourceSpan ?? ph.sourceSpan));
  }
  visitIcuPlaceholder(ph) {
    this.pieces.push(this.createPlaceholderPiece(ph.name, ph.sourceSpan, this.placeholderToMessage[ph.name]));
  }
  createPlaceholderPiece(name, sourceSpan, associatedMessage) {
    return new PlaceholderPiece(formatI18nPlaceholderName(
      name,
      /* useCamelCase */
      false
    ), sourceSpan, associatedMessage);
  }
}
function serializeI18nMessageForLocalize(message) {
  const pieces = [];
  const serializerVisitor2 = new LocalizeSerializerVisitor(message.placeholderToMessage, pieces);
  message.nodes.forEach((node) => node.visit(serializerVisitor2));
  return processMessagePieces(pieces);
}
function getSourceSpan(message) {
  const startNode = message.nodes[0];
  const endNode = message.nodes[message.nodes.length - 1];
  return new ParseSourceSpan(startNode.sourceSpan.fullStart, endNode.sourceSpan.end, startNode.sourceSpan.fullStart, startNode.sourceSpan.details);
}
function processMessagePieces(pieces) {
  const messageParts = [];
  const placeHolders = [];
  if (pieces[0] instanceof PlaceholderPiece) {
    messageParts.push(createEmptyMessagePart(pieces[0].sourceSpan.start));
  }
  for (let i = 0; i < pieces.length; i++) {
    const part = pieces[i];
    if (part instanceof LiteralPiece) {
      messageParts.push(part);
    } else {
      placeHolders.push(part);
      if (pieces[i - 1] instanceof PlaceholderPiece) {
        messageParts.push(createEmptyMessagePart(pieces[i - 1].sourceSpan.end));
      }
    }
  }
  if (pieces[pieces.length - 1] instanceof PlaceholderPiece) {
    messageParts.push(createEmptyMessagePart(pieces[pieces.length - 1].sourceSpan.end));
  }
  return { messageParts, placeHolders };
}
function createEmptyMessagePart(location) {
  return new LiteralPiece("", new ParseSourceSpan(location, location));
}
const NG_I18N_CLOSURE_MODE = "ngI18nClosureMode";
const TRANSLATION_VAR_PREFIX = "i18n_";
const I18N_ICU_MAPPING_PREFIX = "I18N_EXP_";
const ESCAPE = "�";
const CLOSURE_TRANSLATION_VAR_PREFIX = "MSG_";
function getTranslationConstPrefix(extra) {
  return `${CLOSURE_TRANSLATION_VAR_PREFIX}${extra}`.toUpperCase();
}
function declareI18nVariable(variable2) {
  return new DeclareVarStmt(variable2.name, void 0, INFERRED_TYPE, void 0, variable2.sourceSpan);
}
function collectI18nConsts(job) {
  const fileBasedI18nSuffix = job.relativeContextFilePath.replace(/[^A-Za-z0-9]/g, "_").toUpperCase() + "_";
  const extractedAttributesByI18nContext = /* @__PURE__ */ new Map();
  const i18nAttributesByElement = /* @__PURE__ */ new Map();
  const i18nExpressionsByElement = /* @__PURE__ */ new Map();
  const messages = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      if (op.kind === OpKind.ExtractedAttribute && op.i18nContext !== null) {
        const attributes = extractedAttributesByI18nContext.get(op.i18nContext) ?? [];
        attributes.push(op);
        extractedAttributesByI18nContext.set(op.i18nContext, attributes);
      } else if (op.kind === OpKind.I18nAttributes) {
        i18nAttributesByElement.set(op.target, op);
      } else if (op.kind === OpKind.I18nExpression && op.usage === I18nExpressionFor.I18nAttribute) {
        const expressions = i18nExpressionsByElement.get(op.target) ?? [];
        expressions.push(op);
        i18nExpressionsByElement.set(op.target, expressions);
      } else if (op.kind === OpKind.I18nMessage) {
        messages.set(op.xref, op);
      }
    }
  }
  const i18nValuesByContext = /* @__PURE__ */ new Map();
  const messageConstIndices = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.I18nMessage) {
        if (op.messagePlaceholder === null) {
          const { mainVar, statements } = collectMessage(job, fileBasedI18nSuffix, messages, op);
          if (op.i18nBlock !== null) {
            const i18nConst = job.addConst(mainVar, statements);
            messageConstIndices.set(op.i18nBlock, i18nConst);
          } else {
            job.constsInitializers.push(...statements);
            i18nValuesByContext.set(op.i18nContext, mainVar);
            const attributesForMessage = extractedAttributesByI18nContext.get(op.i18nContext);
            if (attributesForMessage !== void 0) {
              for (const attr of attributesForMessage) {
                attr.expression = mainVar.clone();
              }
            }
          }
        }
        OpList.remove(op);
      }
    }
  }
  for (const unit of job.units) {
    for (const elem of unit.create) {
      if (isElementOrContainerOp(elem)) {
        const i18nAttributes2 = i18nAttributesByElement.get(elem.xref);
        if (i18nAttributes2 === void 0) {
          continue;
        }
        let i18nExpressions = i18nExpressionsByElement.get(elem.xref);
        if (i18nExpressions === void 0) {
          throw new Error("AssertionError: Could not find any i18n expressions associated with an I18nAttributes instruction");
        }
        const seenPropertyNames = /* @__PURE__ */ new Set();
        i18nExpressions = i18nExpressions.filter((i18nExpr) => {
          const seen = seenPropertyNames.has(i18nExpr.name);
          seenPropertyNames.add(i18nExpr.name);
          return !seen;
        });
        const i18nAttributeConfig = i18nExpressions.flatMap((i18nExpr) => {
          const i18nExprValue = i18nValuesByContext.get(i18nExpr.context);
          if (i18nExprValue === void 0) {
            throw new Error("AssertionError: Could not find i18n expression's value");
          }
          return [literal(i18nExpr.name), i18nExprValue];
        });
        i18nAttributes2.i18nAttributesConfig = job.addConst(new LiteralArrayExpr(i18nAttributeConfig));
      }
    }
  }
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.I18nStart) {
        const msgIndex = messageConstIndices.get(op.root);
        if (msgIndex === void 0) {
          throw new Error("AssertionError: Could not find corresponding i18n block index for an i18n message op; was an i18n message incorrectly assumed to correspond to an attribute?");
        }
        op.messageIndex = msgIndex;
      }
    }
  }
}
function collectMessage(job, fileBasedI18nSuffix, messages, messageOp) {
  const statements = [];
  const subMessagePlaceholders = /* @__PURE__ */ new Map();
  for (const subMessageId of messageOp.subMessages) {
    const subMessage = messages.get(subMessageId);
    const { mainVar: subMessageVar, statements: subMessageStatements } = collectMessage(job, fileBasedI18nSuffix, messages, subMessage);
    statements.push(...subMessageStatements);
    const subMessages = subMessagePlaceholders.get(subMessage.messagePlaceholder) ?? [];
    subMessages.push(subMessageVar);
    subMessagePlaceholders.set(subMessage.messagePlaceholder, subMessages);
  }
  addSubMessageParams(messageOp, subMessagePlaceholders);
  messageOp.params = new Map([...messageOp.params.entries()].sort());
  const mainVar = variable(job.pool.uniqueName(TRANSLATION_VAR_PREFIX));
  const closureVar = i18nGenerateClosureVar(job.pool, messageOp.message.id, fileBasedI18nSuffix, job.i18nUseExternalIds);
  let transformFn = void 0;
  if (messageOp.needsPostprocessing || messageOp.postprocessingParams.size > 0) {
    const postprocessingParams = Object.fromEntries([...messageOp.postprocessingParams.entries()].sort());
    const formattedPostprocessingParams = formatI18nPlaceholderNamesInMap(
      postprocessingParams,
      /* useCamelCase */
      false
    );
    const extraTransformFnParams = [];
    if (messageOp.postprocessingParams.size > 0) {
      extraTransformFnParams.push(mapLiteral(
        formattedPostprocessingParams,
        /* quoted */
        true
      ));
    }
    transformFn = (expr) => importExpr(Identifiers.i18nPostprocess).callFn([expr, ...extraTransformFnParams]);
  }
  statements.push(...getTranslationDeclStmts(messageOp.message, mainVar, closureVar, messageOp.params, transformFn));
  return { mainVar, statements };
}
function addSubMessageParams(messageOp, subMessagePlaceholders) {
  for (const [placeholder, subMessages] of subMessagePlaceholders) {
    if (subMessages.length === 1) {
      messageOp.params.set(placeholder, subMessages[0]);
    } else {
      messageOp.params.set(placeholder, literal(`${ESCAPE}${I18N_ICU_MAPPING_PREFIX}${placeholder}${ESCAPE}`));
      messageOp.postprocessingParams.set(placeholder, literalArr(subMessages));
    }
  }
}
function getTranslationDeclStmts(message, variable2, closureVar, params, transformFn) {
  const paramsObject = Object.fromEntries(params);
  const statements = [
    declareI18nVariable(variable2),
    ifStmt(createClosureModeGuard(), createGoogleGetMsgStatements(variable2, message, closureVar, paramsObject), createLocalizeStatements(variable2, message, formatI18nPlaceholderNamesInMap(
      paramsObject,
      /* useCamelCase */
      false
    )))
  ];
  if (transformFn) {
    statements.push(new ExpressionStatement(variable2.set(transformFn(variable2))));
  }
  return statements;
}
function createClosureModeGuard() {
  return typeofExpr(variable(NG_I18N_CLOSURE_MODE)).notIdentical(literal("undefined", STRING_TYPE)).and(variable(NG_I18N_CLOSURE_MODE));
}
function i18nGenerateClosureVar(pool, messageId, fileBasedI18nSuffix, useExternalIds) {
  let name;
  const suffix = fileBasedI18nSuffix;
  if (useExternalIds) {
    const prefix = getTranslationConstPrefix(`EXTERNAL_`);
    const uniqueSuffix = pool.uniqueName(suffix);
    name = `${prefix}${sanitizeIdentifier(messageId)}$$${uniqueSuffix}`;
  } else {
    const prefix = getTranslationConstPrefix(suffix);
    name = pool.uniqueName(prefix);
  }
  return variable(name);
}
function convertI18nText(job) {
  for (const unit of job.units) {
    let currentI18n = null;
    let currentIcu = null;
    const textNodeI18nBlocks = /* @__PURE__ */ new Map();
    const textNodeIcus = /* @__PURE__ */ new Map();
    const icuPlaceholderByText = /* @__PURE__ */ new Map();
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nStart:
          if (op.context === null) {
            throw Error("I18n op should have its context set.");
          }
          currentI18n = op;
          break;
        case OpKind.I18nEnd:
          currentI18n = null;
          break;
        case OpKind.IcuStart:
          if (op.context === null) {
            throw Error("Icu op should have its context set.");
          }
          currentIcu = op;
          break;
        case OpKind.IcuEnd:
          currentIcu = null;
          break;
        case OpKind.Text:
          if (currentI18n !== null) {
            textNodeI18nBlocks.set(op.xref, currentI18n);
            textNodeIcus.set(op.xref, currentIcu);
            if (op.icuPlaceholder !== null) {
              const icuPlaceholderOp = createIcuPlaceholderOp(job.allocateXrefId(), op.icuPlaceholder, [op.initialValue]);
              OpList.replace(op, icuPlaceholderOp);
              icuPlaceholderByText.set(op.xref, icuPlaceholderOp);
            } else {
              OpList.remove(op);
            }
          }
          break;
      }
    }
    for (const op of unit.update) {
      switch (op.kind) {
        case OpKind.InterpolateText:
          if (!textNodeI18nBlocks.has(op.target)) {
            continue;
          }
          const i18nOp = textNodeI18nBlocks.get(op.target);
          const icuOp = textNodeIcus.get(op.target);
          const icuPlaceholder = icuPlaceholderByText.get(op.target);
          const contextId = icuOp ? icuOp.context : i18nOp.context;
          const resolutionTime = icuOp ? I18nParamResolutionTime.Postproccessing : I18nParamResolutionTime.Creation;
          const ops = [];
          for (let i = 0; i < op.interpolation.expressions.length; i++) {
            const expr = op.interpolation.expressions[i];
            ops.push(createI18nExpressionOp(contextId, i18nOp.xref, i18nOp.xref, i18nOp.handle, expr, icuPlaceholder?.xref ?? null, op.interpolation.i18nPlaceholders[i] ?? null, resolutionTime, I18nExpressionFor.I18nText, "", expr.sourceSpan ?? op.sourceSpan));
          }
          OpList.replaceWithMany(op, ops);
          if (icuPlaceholder !== void 0) {
            icuPlaceholder.strings = op.interpolation.strings;
          }
          break;
      }
    }
  }
}
function liftLocalRefs(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.ElementStart:
        case OpKind.Template:
          if (!Array.isArray(op.localRefs)) {
            throw new Error(`AssertionError: expected localRefs to be an array still`);
          }
          op.numSlotsUsed += op.localRefs.length;
          if (op.localRefs.length > 0) {
            const localRefs = serializeLocalRefs(op.localRefs);
            op.localRefs = job.addConst(localRefs);
          } else {
            op.localRefs = null;
          }
          break;
      }
    }
  }
}
function serializeLocalRefs(refs) {
  const constRefs = [];
  for (const ref of refs) {
    constRefs.push(literal(ref.name), literal(ref.target));
  }
  return literalArr(constRefs);
}
function emitNamespaceChanges(job) {
  for (const unit of job.units) {
    let activeNamespace = Namespace.HTML;
    for (const op of unit.create) {
      if (op.kind !== OpKind.ElementStart) {
        continue;
      }
      if (op.namespace !== activeNamespace) {
        OpList.insertBefore(createNamespaceOp(op.namespace), op);
        activeNamespace = op.namespace;
      }
    }
  }
}
function parse(value) {
  const styles = [];
  let i = 0;
  let parenDepth = 0;
  let quote = 0;
  let valueStart = 0;
  let propStart = 0;
  let currentProp = null;
  while (i < value.length) {
    const token = value.charCodeAt(i++);
    switch (token) {
      case 40:
        parenDepth++;
        break;
      case 41:
        parenDepth--;
        break;
      case 39:
        if (quote === 0) {
          quote = 39;
        } else if (quote === 39 && value.charCodeAt(i - 1) !== 92) {
          quote = 0;
        }
        break;
      case 34:
        if (quote === 0) {
          quote = 34;
        } else if (quote === 34 && value.charCodeAt(i - 1) !== 92) {
          quote = 0;
        }
        break;
      case 58:
        if (!currentProp && parenDepth === 0 && quote === 0) {
          currentProp = hyphenate(value.substring(propStart, i - 1).trim());
          valueStart = i;
        }
        break;
      case 59:
        if (currentProp && valueStart > 0 && parenDepth === 0 && quote === 0) {
          const styleVal = value.substring(valueStart, i - 1).trim();
          styles.push(currentProp, styleVal);
          propStart = i;
          valueStart = 0;
          currentProp = null;
        }
        break;
    }
  }
  if (currentProp && valueStart) {
    const styleVal = value.slice(valueStart).trim();
    styles.push(currentProp, styleVal);
  }
  return styles;
}
function hyphenate(value) {
  return value.replace(/[a-z][A-Z]/g, (v) => {
    return v.charAt(0) + "-" + v.charAt(1);
  }).toLowerCase();
}
function parseExtractedStyles(job) {
  const elements = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (isElementOrContainerOp(op)) {
        elements.set(op.xref, op);
      }
    }
  }
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.ExtractedAttribute && op.bindingKind === BindingKind.Attribute && isStringLiteral(op.expression)) {
        const target = elements.get(op.target);
        if (target !== void 0 && target.kind === OpKind.Template && target.templateKind === TemplateKind.Structural) {
          continue;
        }
        if (op.name === "style") {
          const parsedStyles = parse(op.expression.value);
          for (let i = 0; i < parsedStyles.length - 1; i += 2) {
            OpList.insertBefore(createExtractedAttributeOp(op.target, BindingKind.StyleProperty, null, parsedStyles[i], literal(parsedStyles[i + 1]), null, null, SecurityContext.STYLE), op);
          }
          OpList.remove(op);
        } else if (op.name === "class") {
          const parsedClasses = op.expression.value.trim().split(/\s+/g);
          for (const parsedClass of parsedClasses) {
            OpList.insertBefore(createExtractedAttributeOp(op.target, BindingKind.ClassName, null, parsedClass, null, null, null, SecurityContext.NONE), op);
          }
          OpList.remove(op);
        }
      }
    }
  }
}
function nameFunctionsAndVariables(job) {
  addNamesToView(job.root, job.componentName, { index: 0 }, job.compatibility === CompatibilityMode.TemplateDefinitionBuilder);
}
function addNamesToView(unit, baseName, state, compatibility) {
  if (unit.fnName === null) {
    unit.fnName = unit.job.pool.uniqueName(
      sanitizeIdentifier(`${baseName}_${unit.job.fnSuffix}`),
      /* alwaysIncludeSuffix */
      false
    );
  }
  const varNames = /* @__PURE__ */ new Map();
  for (const op of unit.ops()) {
    switch (op.kind) {
      case OpKind.Property:
      case OpKind.HostProperty:
        if (op.isAnimationTrigger) {
          op.name = "@" + op.name;
        }
        break;
      case OpKind.Listener:
        if (op.handlerFnName !== null) {
          break;
        }
        if (!op.hostListener && op.targetSlot.slot === null) {
          throw new Error(`Expected a slot to be assigned`);
        }
        let animation = "";
        if (op.isAnimationListener) {
          op.name = `@${op.name}.${op.animationPhase}`;
          animation = "animation";
        }
        if (op.hostListener) {
          op.handlerFnName = `${baseName}_${animation}${op.name}_HostBindingHandler`;
        } else {
          op.handlerFnName = `${unit.fnName}_${op.tag.replace("-", "_")}_${animation}${op.name}_${op.targetSlot.slot}_listener`;
        }
        op.handlerFnName = sanitizeIdentifier(op.handlerFnName);
        break;
      case OpKind.TwoWayListener:
        if (op.handlerFnName !== null) {
          break;
        }
        if (op.targetSlot.slot === null) {
          throw new Error(`Expected a slot to be assigned`);
        }
        op.handlerFnName = sanitizeIdentifier(`${unit.fnName}_${op.tag.replace("-", "_")}_${op.name}_${op.targetSlot.slot}_listener`);
        break;
      case OpKind.Variable:
        varNames.set(op.xref, getVariableName(unit, op.variable, state));
        break;
      case OpKind.RepeaterCreate:
        if (!(unit instanceof ViewCompilationUnit)) {
          throw new Error(`AssertionError: must be compiling a component`);
        }
        if (op.handle.slot === null) {
          throw new Error(`Expected slot to be assigned`);
        }
        if (op.emptyView !== null) {
          const emptyView = unit.job.views.get(op.emptyView);
          addNamesToView(emptyView, `${baseName}_${op.functionNameSuffix}Empty_${op.handle.slot + 2}`, state, compatibility);
        }
        addNamesToView(unit.job.views.get(op.xref), `${baseName}_${op.functionNameSuffix}_${op.handle.slot + 1}`, state, compatibility);
        break;
      case OpKind.Projection:
        if (!(unit instanceof ViewCompilationUnit)) {
          throw new Error(`AssertionError: must be compiling a component`);
        }
        if (op.handle.slot === null) {
          throw new Error(`Expected slot to be assigned`);
        }
        if (op.fallbackView !== null) {
          const fallbackView = unit.job.views.get(op.fallbackView);
          addNamesToView(fallbackView, `${baseName}_ProjectionFallback_${op.handle.slot}`, state, compatibility);
        }
        break;
      case OpKind.Template:
        if (!(unit instanceof ViewCompilationUnit)) {
          throw new Error(`AssertionError: must be compiling a component`);
        }
        const childView = unit.job.views.get(op.xref);
        if (op.handle.slot === null) {
          throw new Error(`Expected slot to be assigned`);
        }
        const suffix = op.functionNameSuffix.length === 0 ? "" : `_${op.functionNameSuffix}`;
        addNamesToView(childView, `${baseName}${suffix}_${op.handle.slot}`, state, compatibility);
        break;
      case OpKind.StyleProp:
        op.name = normalizeStylePropName(op.name);
        if (compatibility) {
          op.name = stripImportant(op.name);
        }
        break;
      case OpKind.ClassProp:
        if (compatibility) {
          op.name = stripImportant(op.name);
        }
        break;
    }
  }
  for (const op of unit.ops()) {
    visitExpressionsInOp(op, (expr) => {
      if (!(expr instanceof ReadVariableExpr) || expr.name !== null) {
        return;
      }
      if (!varNames.has(expr.xref)) {
        throw new Error(`Variable ${expr.xref} not yet named`);
      }
      expr.name = varNames.get(expr.xref);
    });
  }
}
function getVariableName(unit, variable2, state) {
  if (variable2.name === null) {
    switch (variable2.kind) {
      case SemanticVariableKind.Context:
        variable2.name = `ctx_r${state.index++}`;
        break;
      case SemanticVariableKind.Identifier:
        if (unit.job.compatibility === CompatibilityMode.TemplateDefinitionBuilder) {
          const compatPrefix = variable2.identifier === "ctx" ? "i" : "";
          variable2.name = `${variable2.identifier}_${compatPrefix}r${++state.index}`;
        } else {
          variable2.name = `${variable2.identifier}_i${state.index++}`;
        }
        break;
      default:
        variable2.name = `_r${++state.index}`;
        break;
    }
  }
  return variable2.name;
}
function normalizeStylePropName(name) {
  return name.startsWith("--") ? name : hyphenate(name);
}
function stripImportant(name) {
  const importantIndex = name.indexOf("!important");
  if (importantIndex > -1) {
    return name.substring(0, importantIndex);
  }
  return name;
}
function mergeNextContextExpressions(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.Listener || op.kind === OpKind.TwoWayListener) {
        mergeNextContextsInOps(op.handlerOps);
      }
    }
    mergeNextContextsInOps(unit.update);
  }
}
function mergeNextContextsInOps(ops) {
  for (const op of ops) {
    if (op.kind !== OpKind.Statement || !(op.statement instanceof ExpressionStatement) || !(op.statement.expr instanceof NextContextExpr)) {
      continue;
    }
    const mergeSteps = op.statement.expr.steps;
    let tryToMerge = true;
    for (let candidate = op.next; candidate.kind !== OpKind.ListEnd && tryToMerge; candidate = candidate.next) {
      visitExpressionsInOp(candidate, (expr, flags) => {
        if (!isIrExpression(expr)) {
          return expr;
        }
        if (!tryToMerge) {
          return;
        }
        if (flags & VisitorContextFlag.InChildOperation) {
          return;
        }
        switch (expr.kind) {
          case ExpressionKind.NextContext:
            expr.steps += mergeSteps;
            OpList.remove(op);
            tryToMerge = false;
            break;
          case ExpressionKind.GetCurrentView:
          case ExpressionKind.Reference:
          case ExpressionKind.ContextLetReference:
            tryToMerge = false;
            break;
        }
        return;
      });
    }
  }
}
const CONTAINER_TAG = "ng-container";
function generateNgContainerOps(job) {
  for (const unit of job.units) {
    const updatedElementXrefs = /* @__PURE__ */ new Set();
    for (const op of unit.create) {
      if (op.kind === OpKind.ElementStart && op.tag === CONTAINER_TAG) {
        op.kind = OpKind.ContainerStart;
        updatedElementXrefs.add(op.xref);
      }
      if (op.kind === OpKind.ElementEnd && updatedElementXrefs.has(op.xref)) {
        op.kind = OpKind.ContainerEnd;
      }
    }
  }
}
function lookupElement(elements, xref) {
  const el = elements.get(xref);
  if (el === void 0) {
    throw new Error("All attributes should have an element-like target.");
  }
  return el;
}
function disableBindings$1(job) {
  const elements = /* @__PURE__ */ new Map();
  for (const view of job.units) {
    for (const op of view.create) {
      if (!isElementOrContainerOp(op)) {
        continue;
      }
      elements.set(op.xref, op);
    }
  }
  for (const unit of job.units) {
    for (const op of unit.create) {
      if ((op.kind === OpKind.ElementStart || op.kind === OpKind.ContainerStart) && op.nonBindable) {
        OpList.insertAfter(createDisableBindingsOp(op.xref), op);
      }
      if ((op.kind === OpKind.ElementEnd || op.kind === OpKind.ContainerEnd) && lookupElement(elements, op.xref).nonBindable) {
        OpList.insertBefore(createEnableBindingsOp(op.xref), op);
      }
    }
  }
}
function generateNullishCoalesceExpressions(job) {
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      transformExpressionsInOp(op, (expr) => {
        if (!(expr instanceof BinaryOperatorExpr) || expr.operator !== BinaryOperator.NullishCoalesce) {
          return expr;
        }
        const assignment = new AssignTemporaryExpr(expr.lhs.clone(), job.allocateXrefId());
        const read = new ReadTemporaryExpr(assignment.xref);
        return new ConditionalExpr(new BinaryOperatorExpr(BinaryOperator.And, new BinaryOperatorExpr(BinaryOperator.NotIdentical, assignment, NULL_EXPR), new BinaryOperatorExpr(BinaryOperator.NotIdentical, read, new LiteralExpr(void 0))), read.clone(), expr.rhs);
      }, VisitorContextFlag.None);
    }
  }
}
function kindTest(kind) {
  return (op) => op.kind === kind;
}
function kindWithInterpolationTest(kind, interpolation) {
  return (op) => {
    return op.kind === kind && interpolation === op.expression instanceof Interpolation;
  };
}
function basicListenerKindTest(op) {
  return op.kind === OpKind.Listener && !(op.hostListener && op.isAnimationListener) || op.kind === OpKind.TwoWayListener;
}
function nonInterpolationPropertyKindTest(op) {
  return (op.kind === OpKind.Property || op.kind === OpKind.TwoWayProperty) && !(op.expression instanceof Interpolation);
}
const CREATE_ORDERING = [
  { test: (op) => op.kind === OpKind.Listener && op.hostListener && op.isAnimationListener },
  { test: basicListenerKindTest }
];
const UPDATE_ORDERING = [
  { test: kindTest(OpKind.StyleMap), transform: keepLast },
  { test: kindTest(OpKind.ClassMap), transform: keepLast },
  { test: kindTest(OpKind.StyleProp) },
  { test: kindTest(OpKind.ClassProp) },
  { test: kindWithInterpolationTest(OpKind.Attribute, true) },
  { test: kindWithInterpolationTest(OpKind.Property, true) },
  { test: nonInterpolationPropertyKindTest },
  { test: kindWithInterpolationTest(OpKind.Attribute, false) }
];
const UPDATE_HOST_ORDERING = [
  { test: kindWithInterpolationTest(OpKind.HostProperty, true) },
  { test: kindWithInterpolationTest(OpKind.HostProperty, false) },
  { test: kindTest(OpKind.Attribute) },
  { test: kindTest(OpKind.StyleMap), transform: keepLast },
  { test: kindTest(OpKind.ClassMap), transform: keepLast },
  { test: kindTest(OpKind.StyleProp) },
  { test: kindTest(OpKind.ClassProp) }
];
const handledOpKinds = /* @__PURE__ */ new Set([
  OpKind.Listener,
  OpKind.TwoWayListener,
  OpKind.StyleMap,
  OpKind.ClassMap,
  OpKind.StyleProp,
  OpKind.ClassProp,
  OpKind.Property,
  OpKind.TwoWayProperty,
  OpKind.HostProperty,
  OpKind.Attribute
]);
function orderOps(job) {
  for (const unit of job.units) {
    orderWithin(unit.create, CREATE_ORDERING);
    const ordering = unit.job.kind === CompilationJobKind.Host ? UPDATE_HOST_ORDERING : UPDATE_ORDERING;
    orderWithin(unit.update, ordering);
  }
}
function orderWithin(opList, ordering) {
  let opsToOrder = [];
  let firstTargetInGroup = null;
  for (const op of opList) {
    const currentTarget = hasDependsOnSlotContextTrait(op) ? op.target : null;
    if (!handledOpKinds.has(op.kind) || currentTarget !== firstTargetInGroup && firstTargetInGroup !== null && currentTarget !== null) {
      OpList.insertBefore(reorder(opsToOrder, ordering), op);
      opsToOrder = [];
      firstTargetInGroup = null;
    }
    if (handledOpKinds.has(op.kind)) {
      opsToOrder.push(op);
      OpList.remove(op);
      firstTargetInGroup = currentTarget ?? firstTargetInGroup;
    }
  }
  opList.push(reorder(opsToOrder, ordering));
}
function reorder(ops, ordering) {
  const groups = Array.from(ordering, () => new Array());
  for (const op of ops) {
    const groupIndex = ordering.findIndex((o) => o.test(op));
    groups[groupIndex].push(op);
  }
  return groups.flatMap((group, i) => {
    const transform2 = ordering[i].transform;
    return transform2 ? transform2(group) : group;
  });
}
function keepLast(ops) {
  return ops.slice(ops.length - 1);
}
function removeContentSelectors(job) {
  for (const unit of job.units) {
    const elements = createOpXrefMap(unit);
    for (const op of unit.ops()) {
      switch (op.kind) {
        case OpKind.Binding:
          const target = lookupInXrefMap(elements, op.target);
          if (isSelectAttribute(op.name) && target.kind === OpKind.Projection) {
            OpList.remove(op);
          }
          break;
      }
    }
  }
}
function isSelectAttribute(name) {
  return name.toLowerCase() === "select";
}
function lookupInXrefMap(map, xref) {
  const el = map.get(xref);
  if (el === void 0) {
    throw new Error("All attributes should have an slottable target.");
  }
  return el;
}
function createPipes(job) {
  for (const unit of job.units) {
    processPipeBindingsInView(unit);
  }
}
function processPipeBindingsInView(unit) {
  for (const updateOp of unit.update) {
    visitExpressionsInOp(updateOp, (expr, flags) => {
      if (!isIrExpression(expr)) {
        return;
      }
      if (expr.kind !== ExpressionKind.PipeBinding) {
        return;
      }
      if (flags & VisitorContextFlag.InChildOperation) {
        throw new Error(`AssertionError: pipe bindings should not appear in child expressions`);
      }
      if (unit.job.compatibility) {
        const slotHandle = updateOp.target;
        if (slotHandle == void 0) {
          throw new Error(`AssertionError: expected slot handle to be assigned for pipe creation`);
        }
        addPipeToCreationBlock(unit, updateOp.target, expr);
      } else {
        unit.create.push(createPipeOp(expr.target, expr.targetSlot, expr.name));
      }
    });
  }
}
function addPipeToCreationBlock(unit, afterTargetXref, binding) {
  for (let op = unit.create.head.next; op.kind !== OpKind.ListEnd; op = op.next) {
    if (!hasConsumesSlotTrait(op)) {
      continue;
    }
    if (op.xref !== afterTargetXref) {
      continue;
    }
    while (op.next.kind === OpKind.Pipe) {
      op = op.next;
    }
    const pipe2 = createPipeOp(binding.target, binding.targetSlot, binding.name);
    OpList.insertBefore(pipe2, op.next);
    return;
  }
  throw new Error(`AssertionError: unable to find insertion point for pipe ${binding.name}`);
}
function createVariadicPipes(job) {
  for (const unit of job.units) {
    for (const op of unit.update) {
      transformExpressionsInOp(op, (expr) => {
        if (!(expr instanceof PipeBindingExpr)) {
          return expr;
        }
        if (expr.args.length <= 4) {
          return expr;
        }
        return new PipeBindingVariadicExpr(expr.target, expr.targetSlot, expr.name, literalArr(expr.args), expr.args.length);
      }, VisitorContextFlag.None);
    }
  }
}
function propagateI18nBlocks(job) {
  propagateI18nBlocksToTemplates(job.root, 0);
}
function propagateI18nBlocksToTemplates(unit, subTemplateIndex) {
  let i18nBlock = null;
  for (const op of unit.create) {
    switch (op.kind) {
      case OpKind.I18nStart:
        op.subTemplateIndex = subTemplateIndex === 0 ? null : subTemplateIndex;
        i18nBlock = op;
        break;
      case OpKind.I18nEnd:
        if (i18nBlock.subTemplateIndex === null) {
          subTemplateIndex = 0;
        }
        i18nBlock = null;
        break;
      case OpKind.Template:
        subTemplateIndex = propagateI18nBlocksForView(unit.job.views.get(op.xref), i18nBlock, op.i18nPlaceholder, subTemplateIndex);
        break;
      case OpKind.RepeaterCreate:
        const forView = unit.job.views.get(op.xref);
        subTemplateIndex = propagateI18nBlocksForView(forView, i18nBlock, op.i18nPlaceholder, subTemplateIndex);
        if (op.emptyView !== null) {
          subTemplateIndex = propagateI18nBlocksForView(unit.job.views.get(op.emptyView), i18nBlock, op.emptyI18nPlaceholder, subTemplateIndex);
        }
        break;
    }
  }
  return subTemplateIndex;
}
function propagateI18nBlocksForView(view, i18nBlock, i18nPlaceholder, subTemplateIndex) {
  if (i18nPlaceholder !== void 0) {
    if (i18nBlock === null) {
      throw Error("Expected template with i18n placeholder to be in an i18n block.");
    }
    subTemplateIndex++;
    wrapTemplateWithI18n(view, i18nBlock);
  }
  return propagateI18nBlocksToTemplates(view, subTemplateIndex);
}
function wrapTemplateWithI18n(unit, parentI18n) {
  if (unit.create.head.next?.kind !== OpKind.I18nStart) {
    const id = unit.job.allocateXrefId();
    OpList.insertAfter(
      // Nested ng-template i18n start/end ops should not receive source spans.
      createI18nStartOp(id, parentI18n.message, parentI18n.root, null),
      unit.create.head
    );
    OpList.insertBefore(createI18nEndOp(id, null), unit.create.tail);
  }
}
function extractPureFunctions(job) {
  for (const view of job.units) {
    for (const op of view.ops()) {
      visitExpressionsInOp(op, (expr) => {
        if (!(expr instanceof PureFunctionExpr) || expr.body === null) {
          return;
        }
        const constantDef = new PureFunctionConstant(expr.args.length);
        expr.fn = job.pool.getSharedConstant(constantDef, expr.body);
        expr.body = null;
      });
    }
  }
}
class PureFunctionConstant extends GenericKeyFn {
  numArgs;
  constructor(numArgs) {
    super();
    this.numArgs = numArgs;
  }
  keyOf(expr) {
    if (expr instanceof PureFunctionParameterExpr) {
      return `param(${expr.index})`;
    } else {
      return super.keyOf(expr);
    }
  }
  // TODO: Use the new pool method `getSharedFunctionReference`
  toSharedConstantDeclaration(declName, keyExpr) {
    const fnParams = [];
    for (let idx = 0; idx < this.numArgs; idx++) {
      fnParams.push(new FnParam("a" + idx));
    }
    const returnExpr = transformExpressionsInExpression(keyExpr, (expr) => {
      if (!(expr instanceof PureFunctionParameterExpr)) {
        return expr;
      }
      return variable("a" + expr.index);
    }, VisitorContextFlag.None);
    return new DeclareVarStmt(declName, new ArrowFunctionExpr(fnParams, returnExpr), void 0, StmtModifier.Final);
  }
}
function generatePureLiteralStructures(job) {
  for (const unit of job.units) {
    for (const op of unit.update) {
      transformExpressionsInOp(op, (expr, flags) => {
        if (flags & VisitorContextFlag.InChildOperation) {
          return expr;
        }
        if (expr instanceof LiteralArrayExpr) {
          return transformLiteralArray(expr);
        } else if (expr instanceof LiteralMapExpr) {
          return transformLiteralMap(expr);
        }
        return expr;
      }, VisitorContextFlag.None);
    }
  }
}
function transformLiteralArray(expr) {
  const derivedEntries = [];
  const nonConstantArgs = [];
  for (const entry of expr.entries) {
    if (entry.isConstant()) {
      derivedEntries.push(entry);
    } else {
      const idx = nonConstantArgs.length;
      nonConstantArgs.push(entry);
      derivedEntries.push(new PureFunctionParameterExpr(idx));
    }
  }
  return new PureFunctionExpr(literalArr(derivedEntries), nonConstantArgs);
}
function transformLiteralMap(expr) {
  let derivedEntries = [];
  const nonConstantArgs = [];
  for (const entry of expr.entries) {
    if (entry.value.isConstant()) {
      derivedEntries.push(entry);
    } else {
      const idx = nonConstantArgs.length;
      nonConstantArgs.push(entry.value);
      derivedEntries.push(new LiteralMapEntry(entry.key, new PureFunctionParameterExpr(idx), entry.quoted));
    }
  }
  return new PureFunctionExpr(literalMap(derivedEntries), nonConstantArgs);
}
function element(slot, tag, constIndex, localRefIndex, sourceSpan) {
  return elementOrContainerBase(Identifiers.element, slot, tag, constIndex, localRefIndex, sourceSpan);
}
function elementStart(slot, tag, constIndex, localRefIndex, sourceSpan) {
  return elementOrContainerBase(Identifiers.elementStart, slot, tag, constIndex, localRefIndex, sourceSpan);
}
function elementOrContainerBase(instruction, slot, tag, constIndex, localRefIndex, sourceSpan) {
  const args = [literal(slot)];
  if (tag !== null) {
    args.push(literal(tag));
  }
  if (localRefIndex !== null) {
    args.push(
      literal(constIndex),
      // might be null, but that's okay.
      literal(localRefIndex)
    );
  } else if (constIndex !== null) {
    args.push(literal(constIndex));
  }
  return call(instruction, args, sourceSpan);
}
function elementEnd(sourceSpan) {
  return call(Identifiers.elementEnd, [], sourceSpan);
}
function elementContainerStart(slot, constIndex, localRefIndex, sourceSpan) {
  return elementOrContainerBase(
    Identifiers.elementContainerStart,
    slot,
    /* tag */
    null,
    constIndex,
    localRefIndex,
    sourceSpan
  );
}
function elementContainer(slot, constIndex, localRefIndex, sourceSpan) {
  return elementOrContainerBase(
    Identifiers.elementContainer,
    slot,
    /* tag */
    null,
    constIndex,
    localRefIndex,
    sourceSpan
  );
}
function elementContainerEnd() {
  return call(Identifiers.elementContainerEnd, [], null);
}
function template(slot, templateFnRef, decls, vars, tag, constIndex, localRefs, sourceSpan) {
  const args = [
    literal(slot),
    templateFnRef,
    literal(decls),
    literal(vars),
    literal(tag),
    literal(constIndex)
  ];
  if (localRefs !== null) {
    args.push(literal(localRefs));
    args.push(importExpr(Identifiers.templateRefExtractor));
  }
  while (args[args.length - 1].isEquivalent(NULL_EXPR)) {
    args.pop();
  }
  return call(Identifiers.templateCreate, args, sourceSpan);
}
function disableBindings() {
  return call(Identifiers.disableBindings, [], null);
}
function enableBindings() {
  return call(Identifiers.enableBindings, [], null);
}
function listener(name, handlerFn, eventTargetResolver, syntheticHost, sourceSpan) {
  const args = [literal(name), handlerFn];
  if (eventTargetResolver !== null) {
    args.push(literal(false));
    args.push(importExpr(eventTargetResolver));
  }
  return call(syntheticHost ? Identifiers.syntheticHostListener : Identifiers.listener, args, sourceSpan);
}
function twoWayBindingSet(target, value) {
  return importExpr(Identifiers.twoWayBindingSet).callFn([target, value]);
}
function twoWayListener(name, handlerFn, sourceSpan) {
  return call(Identifiers.twoWayListener, [literal(name), handlerFn], sourceSpan);
}
function pipe(slot, name) {
  return call(Identifiers.pipe, [literal(slot), literal(name)], null);
}
function namespaceHTML() {
  return call(Identifiers.namespaceHTML, [], null);
}
function namespaceSVG() {
  return call(Identifiers.namespaceSVG, [], null);
}
function namespaceMath() {
  return call(Identifiers.namespaceMathML, [], null);
}
function advance(delta, sourceSpan) {
  return call(Identifiers.advance, delta > 1 ? [literal(delta)] : [], sourceSpan);
}
function reference(slot) {
  return importExpr(Identifiers.reference).callFn([literal(slot)]);
}
function nextContext(steps) {
  return importExpr(Identifiers.nextContext).callFn(steps === 1 ? [] : [literal(steps)]);
}
function getCurrentView() {
  return importExpr(Identifiers.getCurrentView).callFn([]);
}
function restoreView(savedView) {
  return importExpr(Identifiers.restoreView).callFn([savedView]);
}
function resetView(returnValue) {
  return importExpr(Identifiers.resetView).callFn([returnValue]);
}
function text(slot, initialValue, sourceSpan) {
  const args = [literal(slot, null)];
  if (initialValue !== "") {
    args.push(literal(initialValue));
  }
  return call(Identifiers.text, args, sourceSpan);
}
function defer(selfSlot, primarySlot, dependencyResolverFn, loadingSlot, placeholderSlot, errorSlot, loadingConfig, placeholderConfig, enableTimerScheduling, sourceSpan, flags) {
  const args = [
    literal(selfSlot),
    literal(primarySlot),
    dependencyResolverFn ?? literal(null),
    literal(loadingSlot),
    literal(placeholderSlot),
    literal(errorSlot),
    loadingConfig ?? literal(null),
    placeholderConfig ?? literal(null),
    enableTimerScheduling ? importExpr(Identifiers.deferEnableTimerScheduling) : literal(null),
    literal(flags)
  ];
  let expr;
  while ((expr = args[args.length - 1]) !== null && expr instanceof LiteralExpr && expr.value === null) {
    args.pop();
  }
  return call(Identifiers.defer, args, sourceSpan);
}
const deferTriggerToR3TriggerInstructionsMap = /* @__PURE__ */ new Map([
  [
    DeferTriggerKind.Idle,
    {
      [
        "none"
        /* ir.DeferOpModifierKind.NONE */
      ]: Identifiers.deferOnIdle,
      [
        "prefetch"
        /* ir.DeferOpModifierKind.PREFETCH */
      ]: Identifiers.deferPrefetchOnIdle,
      [
        "hydrate"
        /* ir.DeferOpModifierKind.HYDRATE */
      ]: Identifiers.deferHydrateOnIdle
    }
  ],
  [
    DeferTriggerKind.Immediate,
    {
      [
        "none"
        /* ir.DeferOpModifierKind.NONE */
      ]: Identifiers.deferOnImmediate,
      [
        "prefetch"
        /* ir.DeferOpModifierKind.PREFETCH */
      ]: Identifiers.deferPrefetchOnImmediate,
      [
        "hydrate"
        /* ir.DeferOpModifierKind.HYDRATE */
      ]: Identifiers.deferHydrateOnImmediate
    }
  ],
  [
    DeferTriggerKind.Timer,
    {
      [
        "none"
        /* ir.DeferOpModifierKind.NONE */
      ]: Identifiers.deferOnTimer,
      [
        "prefetch"
        /* ir.DeferOpModifierKind.PREFETCH */
      ]: Identifiers.deferPrefetchOnTimer,
      [
        "hydrate"
        /* ir.DeferOpModifierKind.HYDRATE */
      ]: Identifiers.deferHydrateOnTimer
    }
  ],
  [
    DeferTriggerKind.Hover,
    {
      [
        "none"
        /* ir.DeferOpModifierKind.NONE */
      ]: Identifiers.deferOnHover,
      [
        "prefetch"
        /* ir.DeferOpModifierKind.PREFETCH */
      ]: Identifiers.deferPrefetchOnHover,
      [
        "hydrate"
        /* ir.DeferOpModifierKind.HYDRATE */
      ]: Identifiers.deferHydrateOnHover
    }
  ],
  [
    DeferTriggerKind.Interaction,
    {
      [
        "none"
        /* ir.DeferOpModifierKind.NONE */
      ]: Identifiers.deferOnInteraction,
      [
        "prefetch"
        /* ir.DeferOpModifierKind.PREFETCH */
      ]: Identifiers.deferPrefetchOnInteraction,
      [
        "hydrate"
        /* ir.DeferOpModifierKind.HYDRATE */
      ]: Identifiers.deferHydrateOnInteraction
    }
  ],
  [
    DeferTriggerKind.Viewport,
    {
      [
        "none"
        /* ir.DeferOpModifierKind.NONE */
      ]: Identifiers.deferOnViewport,
      [
        "prefetch"
        /* ir.DeferOpModifierKind.PREFETCH */
      ]: Identifiers.deferPrefetchOnViewport,
      [
        "hydrate"
        /* ir.DeferOpModifierKind.HYDRATE */
      ]: Identifiers.deferHydrateOnViewport
    }
  ],
  [
    DeferTriggerKind.Never,
    {
      [
        "none"
        /* ir.DeferOpModifierKind.NONE */
      ]: Identifiers.deferHydrateNever,
      [
        "prefetch"
        /* ir.DeferOpModifierKind.PREFETCH */
      ]: Identifiers.deferHydrateNever,
      [
        "hydrate"
        /* ir.DeferOpModifierKind.HYDRATE */
      ]: Identifiers.deferHydrateNever
    }
  ]
]);
function deferOn(trigger, args, modifier, sourceSpan) {
  const instructionToCall = deferTriggerToR3TriggerInstructionsMap.get(trigger)?.[modifier];
  if (instructionToCall === void 0) {
    throw new Error(`Unable to determine instruction for trigger ${trigger}`);
  }
  return call(instructionToCall, args.map((a) => literal(a)), sourceSpan);
}
function projectionDef(def) {
  return call(Identifiers.projectionDef, def ? [def] : [], null);
}
function projection(slot, projectionSlotIndex, attributes, fallbackFnName, fallbackDecls, fallbackVars, sourceSpan) {
  const args = [literal(slot)];
  if (projectionSlotIndex !== 0 || attributes !== null || fallbackFnName !== null) {
    args.push(literal(projectionSlotIndex));
    if (attributes !== null) {
      args.push(attributes);
    }
    if (fallbackFnName !== null) {
      if (attributes === null) {
        args.push(literal(null));
      }
      args.push(variable(fallbackFnName), literal(fallbackDecls), literal(fallbackVars));
    }
  }
  return call(Identifiers.projection, args, sourceSpan);
}
function i18nStart(slot, constIndex, subTemplateIndex, sourceSpan) {
  const args = [literal(slot), literal(constIndex)];
  if (subTemplateIndex !== null) {
    args.push(literal(subTemplateIndex));
  }
  return call(Identifiers.i18nStart, args, sourceSpan);
}
function repeaterCreate(slot, viewFnName, decls, vars, tag, constIndex, trackByFn, trackByUsesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, emptyTag, emptyConstIndex, sourceSpan) {
  const args = [
    literal(slot),
    variable(viewFnName),
    literal(decls),
    literal(vars),
    literal(tag),
    literal(constIndex),
    trackByFn
  ];
  if (trackByUsesComponentInstance || emptyViewFnName !== null) {
    args.push(literal(trackByUsesComponentInstance));
    if (emptyViewFnName !== null) {
      args.push(variable(emptyViewFnName), literal(emptyDecls), literal(emptyVars));
      if (emptyTag !== null || emptyConstIndex !== null) {
        args.push(literal(emptyTag));
      }
      if (emptyConstIndex !== null) {
        args.push(literal(emptyConstIndex));
      }
    }
  }
  return call(Identifiers.repeaterCreate, args, sourceSpan);
}
function repeater(collection, sourceSpan) {
  return call(Identifiers.repeater, [collection], sourceSpan);
}
function deferWhen(modifier, expr, sourceSpan) {
  if (modifier === "prefetch") {
    return call(Identifiers.deferPrefetchWhen, [expr], sourceSpan);
  } else if (modifier === "hydrate") {
    return call(Identifiers.deferHydrateWhen, [expr], sourceSpan);
  }
  return call(Identifiers.deferWhen, [expr], sourceSpan);
}
function declareLet(slot, sourceSpan) {
  return call(Identifiers.declareLet, [literal(slot)], sourceSpan);
}
function storeLet(value, sourceSpan) {
  return importExpr(Identifiers.storeLet).callFn([value], sourceSpan);
}
function readContextLet(slot) {
  return importExpr(Identifiers.readContextLet).callFn([literal(slot)]);
}
function i18n(slot, constIndex, subTemplateIndex, sourceSpan) {
  const args = [literal(slot), literal(constIndex)];
  if (subTemplateIndex) {
    args.push(literal(subTemplateIndex));
  }
  return call(Identifiers.i18n, args, sourceSpan);
}
function i18nEnd(endSourceSpan) {
  return call(Identifiers.i18nEnd, [], endSourceSpan);
}
function i18nAttributes(slot, i18nAttributesConfig) {
  const args = [literal(slot), literal(i18nAttributesConfig)];
  return call(Identifiers.i18nAttributes, args, null);
}
function property(name, expression, sanitizer, sourceSpan) {
  const args = [literal(name), expression];
  if (sanitizer !== null) {
    args.push(sanitizer);
  }
  return call(Identifiers.property, args, sourceSpan);
}
function twoWayProperty(name, expression, sanitizer, sourceSpan) {
  const args = [literal(name), expression];
  if (sanitizer !== null) {
    args.push(sanitizer);
  }
  return call(Identifiers.twoWayProperty, args, sourceSpan);
}
function attribute(name, expression, sanitizer, namespace) {
  const args = [literal(name), expression];
  if (sanitizer !== null || namespace !== null) {
    args.push(sanitizer ?? literal(null));
  }
  if (namespace !== null) {
    args.push(literal(namespace));
  }
  return call(Identifiers.attribute, args, null);
}
function styleProp(name, expression, unit, sourceSpan) {
  const args = [literal(name), expression];
  if (unit !== null) {
    args.push(literal(unit));
  }
  return call(Identifiers.styleProp, args, sourceSpan);
}
function classProp(name, expression, sourceSpan) {
  return call(Identifiers.classProp, [literal(name), expression], sourceSpan);
}
function styleMap(expression, sourceSpan) {
  return call(Identifiers.styleMap, [expression], sourceSpan);
}
function classMap(expression, sourceSpan) {
  return call(Identifiers.classMap, [expression], sourceSpan);
}
const PIPE_BINDINGS = [
  Identifiers.pipeBind1,
  Identifiers.pipeBind2,
  Identifiers.pipeBind3,
  Identifiers.pipeBind4
];
function pipeBind(slot, varOffset, args) {
  if (args.length < 1 || args.length > PIPE_BINDINGS.length) {
    throw new Error(`pipeBind() argument count out of bounds`);
  }
  const instruction = PIPE_BINDINGS[args.length - 1];
  return importExpr(instruction).callFn([literal(slot), literal(varOffset), ...args]);
}
function pipeBindV(slot, varOffset, args) {
  return importExpr(Identifiers.pipeBindV).callFn([literal(slot), literal(varOffset), args]);
}
function textInterpolate(strings, expressions, sourceSpan) {
  const interpolationArgs = collateInterpolationArgs(strings, expressions);
  return callVariadicInstruction(TEXT_INTERPOLATE_CONFIG, [], interpolationArgs, [], sourceSpan);
}
function i18nExp(expr, sourceSpan) {
  return call(Identifiers.i18nExp, [expr], sourceSpan);
}
function i18nApply(slot, sourceSpan) {
  return call(Identifiers.i18nApply, [literal(slot)], sourceSpan);
}
function propertyInterpolate(name, strings, expressions, sanitizer, sourceSpan) {
  const interpolationArgs = collateInterpolationArgs(strings, expressions);
  const extraArgs = [];
  if (sanitizer !== null) {
    extraArgs.push(sanitizer);
  }
  return callVariadicInstruction(PROPERTY_INTERPOLATE_CONFIG, [literal(name)], interpolationArgs, extraArgs, sourceSpan);
}
function attributeInterpolate(name, strings, expressions, sanitizer, sourceSpan) {
  const interpolationArgs = collateInterpolationArgs(strings, expressions);
  const extraArgs = [];
  if (sanitizer !== null) {
    extraArgs.push(sanitizer);
  }
  return callVariadicInstruction(ATTRIBUTE_INTERPOLATE_CONFIG, [literal(name)], interpolationArgs, extraArgs, sourceSpan);
}
function stylePropInterpolate(name, strings, expressions, unit, sourceSpan) {
  const interpolationArgs = collateInterpolationArgs(strings, expressions);
  const extraArgs = [];
  if (unit !== null) {
    extraArgs.push(literal(unit));
  }
  return callVariadicInstruction(STYLE_PROP_INTERPOLATE_CONFIG, [literal(name)], interpolationArgs, extraArgs, sourceSpan);
}
function styleMapInterpolate(strings, expressions, sourceSpan) {
  const interpolationArgs = collateInterpolationArgs(strings, expressions);
  return callVariadicInstruction(STYLE_MAP_INTERPOLATE_CONFIG, [], interpolationArgs, [], sourceSpan);
}
function classMapInterpolate(strings, expressions, sourceSpan) {
  const interpolationArgs = collateInterpolationArgs(strings, expressions);
  return callVariadicInstruction(CLASS_MAP_INTERPOLATE_CONFIG, [], interpolationArgs, [], sourceSpan);
}
function hostProperty(name, expression, sanitizer, sourceSpan) {
  const args = [literal(name), expression];
  if (sanitizer !== null) {
    args.push(sanitizer);
  }
  return call(Identifiers.hostProperty, args, sourceSpan);
}
function syntheticHostProperty(name, expression, sourceSpan) {
  return call(Identifiers.syntheticHostProperty, [literal(name), expression], sourceSpan);
}
function pureFunction(varOffset, fn2, args) {
  return callVariadicInstructionExpr(PURE_FUNCTION_CONFIG, [literal(varOffset), fn2], args, [], null);
}
function collateInterpolationArgs(strings, expressions) {
  if (strings.length < 1 || expressions.length !== strings.length - 1) {
    throw new Error(`AssertionError: expected specific shape of args for strings/expressions in interpolation`);
  }
  const interpolationArgs = [];
  if (expressions.length === 1 && strings[0] === "" && strings[1] === "") {
    interpolationArgs.push(expressions[0]);
  } else {
    let idx;
    for (idx = 0; idx < expressions.length; idx++) {
      interpolationArgs.push(literal(strings[idx]), expressions[idx]);
    }
    interpolationArgs.push(literal(strings[idx]));
  }
  return interpolationArgs;
}
function call(instruction, args, sourceSpan) {
  const expr = importExpr(instruction).callFn(args, sourceSpan);
  return createStatementOp(new ExpressionStatement(expr, sourceSpan));
}
function conditional(condition, contextValue, sourceSpan) {
  const args = [condition];
  if (contextValue !== null) {
    args.push(contextValue);
  }
  return call(Identifiers.conditional, args, sourceSpan);
}
const TEXT_INTERPOLATE_CONFIG = {
  constant: [
    Identifiers.textInterpolate,
    Identifiers.textInterpolate1,
    Identifiers.textInterpolate2,
    Identifiers.textInterpolate3,
    Identifiers.textInterpolate4,
    Identifiers.textInterpolate5,
    Identifiers.textInterpolate6,
    Identifiers.textInterpolate7,
    Identifiers.textInterpolate8
  ],
  variable: Identifiers.textInterpolateV,
  mapping: (n) => {
    if (n % 2 === 0) {
      throw new Error(`Expected odd number of arguments`);
    }
    return (n - 1) / 2;
  }
};
const PROPERTY_INTERPOLATE_CONFIG = {
  constant: [
    Identifiers.propertyInterpolate,
    Identifiers.propertyInterpolate1,
    Identifiers.propertyInterpolate2,
    Identifiers.propertyInterpolate3,
    Identifiers.propertyInterpolate4,
    Identifiers.propertyInterpolate5,
    Identifiers.propertyInterpolate6,
    Identifiers.propertyInterpolate7,
    Identifiers.propertyInterpolate8
  ],
  variable: Identifiers.propertyInterpolateV,
  mapping: (n) => {
    if (n % 2 === 0) {
      throw new Error(`Expected odd number of arguments`);
    }
    return (n - 1) / 2;
  }
};
const STYLE_PROP_INTERPOLATE_CONFIG = {
  constant: [
    Identifiers.styleProp,
    Identifiers.stylePropInterpolate1,
    Identifiers.stylePropInterpolate2,
    Identifiers.stylePropInterpolate3,
    Identifiers.stylePropInterpolate4,
    Identifiers.stylePropInterpolate5,
    Identifiers.stylePropInterpolate6,
    Identifiers.stylePropInterpolate7,
    Identifiers.stylePropInterpolate8
  ],
  variable: Identifiers.stylePropInterpolateV,
  mapping: (n) => {
    if (n % 2 === 0) {
      throw new Error(`Expected odd number of arguments`);
    }
    return (n - 1) / 2;
  }
};
const ATTRIBUTE_INTERPOLATE_CONFIG = {
  constant: [
    Identifiers.attribute,
    Identifiers.attributeInterpolate1,
    Identifiers.attributeInterpolate2,
    Identifiers.attributeInterpolate3,
    Identifiers.attributeInterpolate4,
    Identifiers.attributeInterpolate5,
    Identifiers.attributeInterpolate6,
    Identifiers.attributeInterpolate7,
    Identifiers.attributeInterpolate8
  ],
  variable: Identifiers.attributeInterpolateV,
  mapping: (n) => {
    if (n % 2 === 0) {
      throw new Error(`Expected odd number of arguments`);
    }
    return (n - 1) / 2;
  }
};
const STYLE_MAP_INTERPOLATE_CONFIG = {
  constant: [
    Identifiers.styleMap,
    Identifiers.styleMapInterpolate1,
    Identifiers.styleMapInterpolate2,
    Identifiers.styleMapInterpolate3,
    Identifiers.styleMapInterpolate4,
    Identifiers.styleMapInterpolate5,
    Identifiers.styleMapInterpolate6,
    Identifiers.styleMapInterpolate7,
    Identifiers.styleMapInterpolate8
  ],
  variable: Identifiers.styleMapInterpolateV,
  mapping: (n) => {
    if (n % 2 === 0) {
      throw new Error(`Expected odd number of arguments`);
    }
    return (n - 1) / 2;
  }
};
const CLASS_MAP_INTERPOLATE_CONFIG = {
  constant: [
    Identifiers.classMap,
    Identifiers.classMapInterpolate1,
    Identifiers.classMapInterpolate2,
    Identifiers.classMapInterpolate3,
    Identifiers.classMapInterpolate4,
    Identifiers.classMapInterpolate5,
    Identifiers.classMapInterpolate6,
    Identifiers.classMapInterpolate7,
    Identifiers.classMapInterpolate8
  ],
  variable: Identifiers.classMapInterpolateV,
  mapping: (n) => {
    if (n % 2 === 0) {
      throw new Error(`Expected odd number of arguments`);
    }
    return (n - 1) / 2;
  }
};
const PURE_FUNCTION_CONFIG = {
  constant: [
    Identifiers.pureFunction0,
    Identifiers.pureFunction1,
    Identifiers.pureFunction2,
    Identifiers.pureFunction3,
    Identifiers.pureFunction4,
    Identifiers.pureFunction5,
    Identifiers.pureFunction6,
    Identifiers.pureFunction7,
    Identifiers.pureFunction8
  ],
  variable: Identifiers.pureFunctionV,
  mapping: (n) => n
};
function callVariadicInstructionExpr(config, baseArgs, interpolationArgs, extraArgs, sourceSpan) {
  const n = config.mapping(interpolationArgs.length);
  if (n < config.constant.length) {
    return importExpr(config.constant[n]).callFn([...baseArgs, ...interpolationArgs, ...extraArgs], sourceSpan);
  } else if (config.variable !== null) {
    return importExpr(config.variable).callFn([...baseArgs, literalArr(interpolationArgs), ...extraArgs], sourceSpan);
  } else {
    throw new Error(`AssertionError: unable to call variadic function`);
  }
}
function callVariadicInstruction(config, baseArgs, interpolationArgs, extraArgs, sourceSpan) {
  return createStatementOp(callVariadicInstructionExpr(config, baseArgs, interpolationArgs, extraArgs, sourceSpan).toStmt());
}
const GLOBAL_TARGET_RESOLVERS = /* @__PURE__ */ new Map([
  ["window", Identifiers.resolveWindow],
  ["document", Identifiers.resolveDocument],
  ["body", Identifiers.resolveBody]
]);
function reify(job) {
  for (const unit of job.units) {
    reifyCreateOperations(unit, unit.create);
    reifyUpdateOperations(unit, unit.update);
  }
}
function reifyCreateOperations(unit, ops) {
  for (const op of ops) {
    transformExpressionsInOp(op, reifyIrExpression, VisitorContextFlag.None);
    switch (op.kind) {
      case OpKind.Text:
        OpList.replace(op, text(op.handle.slot, op.initialValue, op.sourceSpan));
        break;
      case OpKind.ElementStart:
        OpList.replace(op, elementStart(op.handle.slot, op.tag, op.attributes, op.localRefs, op.startSourceSpan));
        break;
      case OpKind.Element:
        OpList.replace(op, element(op.handle.slot, op.tag, op.attributes, op.localRefs, op.wholeSourceSpan));
        break;
      case OpKind.ElementEnd:
        OpList.replace(op, elementEnd(op.sourceSpan));
        break;
      case OpKind.ContainerStart:
        OpList.replace(op, elementContainerStart(op.handle.slot, op.attributes, op.localRefs, op.startSourceSpan));
        break;
      case OpKind.Container:
        OpList.replace(op, elementContainer(op.handle.slot, op.attributes, op.localRefs, op.wholeSourceSpan));
        break;
      case OpKind.ContainerEnd:
        OpList.replace(op, elementContainerEnd());
        break;
      case OpKind.I18nStart:
        OpList.replace(op, i18nStart(op.handle.slot, op.messageIndex, op.subTemplateIndex, op.sourceSpan));
        break;
      case OpKind.I18nEnd:
        OpList.replace(op, i18nEnd(op.sourceSpan));
        break;
      case OpKind.I18n:
        OpList.replace(op, i18n(op.handle.slot, op.messageIndex, op.subTemplateIndex, op.sourceSpan));
        break;
      case OpKind.I18nAttributes:
        if (op.i18nAttributesConfig === null) {
          throw new Error(`AssertionError: i18nAttributesConfig was not set`);
        }
        OpList.replace(op, i18nAttributes(op.handle.slot, op.i18nAttributesConfig));
        break;
      case OpKind.Template:
        if (!(unit instanceof ViewCompilationUnit)) {
          throw new Error(`AssertionError: must be compiling a component`);
        }
        if (Array.isArray(op.localRefs)) {
          throw new Error(`AssertionError: local refs array should have been extracted into a constant`);
        }
        const childView = unit.job.views.get(op.xref);
        OpList.replace(op, template(op.handle.slot, variable(childView.fnName), childView.decls, childView.vars, op.tag, op.attributes, op.localRefs, op.startSourceSpan));
        break;
      case OpKind.DisableBindings:
        OpList.replace(op, disableBindings());
        break;
      case OpKind.EnableBindings:
        OpList.replace(op, enableBindings());
        break;
      case OpKind.Pipe:
        OpList.replace(op, pipe(op.handle.slot, op.name));
        break;
      case OpKind.DeclareLet:
        OpList.replace(op, declareLet(op.handle.slot, op.sourceSpan));
        break;
      case OpKind.Listener:
        const listenerFn = reifyListenerHandler(unit, op.handlerFnName, op.handlerOps, op.consumesDollarEvent);
        const eventTargetResolver = op.eventTarget ? GLOBAL_TARGET_RESOLVERS.get(op.eventTarget) : null;
        if (eventTargetResolver === void 0) {
          throw new Error(`Unexpected global target '${op.eventTarget}' defined for '${op.name}' event. Supported list of global targets: window,document,body.`);
        }
        OpList.replace(op, listener(op.name, listenerFn, eventTargetResolver, op.hostListener && op.isAnimationListener, op.sourceSpan));
        break;
      case OpKind.TwoWayListener:
        OpList.replace(op, twoWayListener(op.name, reifyListenerHandler(unit, op.handlerFnName, op.handlerOps, true), op.sourceSpan));
        break;
      case OpKind.Variable:
        if (op.variable.name === null) {
          throw new Error(`AssertionError: unnamed variable ${op.xref}`);
        }
        OpList.replace(op, createStatementOp(new DeclareVarStmt(op.variable.name, op.initializer, void 0, StmtModifier.Final)));
        break;
      case OpKind.Namespace:
        switch (op.active) {
          case Namespace.HTML:
            OpList.replace(op, namespaceHTML());
            break;
          case Namespace.SVG:
            OpList.replace(op, namespaceSVG());
            break;
          case Namespace.Math:
            OpList.replace(op, namespaceMath());
            break;
        }
        break;
      case OpKind.Defer:
        const timerScheduling = !!op.loadingMinimumTime || !!op.loadingAfterTime || !!op.placeholderMinimumTime;
        OpList.replace(op, defer(op.handle.slot, op.mainSlot.slot, op.resolverFn, op.loadingSlot?.slot ?? null, op.placeholderSlot?.slot ?? null, op.errorSlot?.slot ?? null, op.loadingConfig, op.placeholderConfig, timerScheduling, op.sourceSpan, op.flags));
        break;
      case OpKind.DeferOn:
        let args = [];
        switch (op.trigger.kind) {
          case DeferTriggerKind.Never:
          case DeferTriggerKind.Idle:
          case DeferTriggerKind.Immediate:
            break;
          case DeferTriggerKind.Timer:
            args = [op.trigger.delay];
            break;
          case DeferTriggerKind.Interaction:
          case DeferTriggerKind.Hover:
          case DeferTriggerKind.Viewport:
            if (op.modifier === "hydrate") {
              args = [];
            } else {
              if (op.trigger.targetSlot?.slot == null || op.trigger.targetSlotViewSteps === null) {
                throw new Error(`Slot or view steps not set in trigger reification for trigger kind ${op.trigger.kind}`);
              }
              args = [op.trigger.targetSlot.slot];
              if (op.trigger.targetSlotViewSteps !== 0) {
                args.push(op.trigger.targetSlotViewSteps);
              }
            }
            break;
          default:
            throw new Error(`AssertionError: Unsupported reification of defer trigger kind ${op.trigger.kind}`);
        }
        OpList.replace(op, deferOn(op.trigger.kind, args, op.modifier, op.sourceSpan));
        break;
      case OpKind.ProjectionDef:
        OpList.replace(op, projectionDef(op.def));
        break;
      case OpKind.Projection:
        if (op.handle.slot === null) {
          throw new Error("No slot was assigned for project instruction");
        }
        let fallbackViewFnName = null;
        let fallbackDecls = null;
        let fallbackVars = null;
        if (op.fallbackView !== null) {
          if (!(unit instanceof ViewCompilationUnit)) {
            throw new Error(`AssertionError: must be compiling a component`);
          }
          const fallbackView = unit.job.views.get(op.fallbackView);
          if (fallbackView === void 0) {
            throw new Error("AssertionError: projection had fallback view xref, but fallback view was not found");
          }
          if (fallbackView.fnName === null || fallbackView.decls === null || fallbackView.vars === null) {
            throw new Error(`AssertionError: expected projection fallback view to have been named and counted`);
          }
          fallbackViewFnName = fallbackView.fnName;
          fallbackDecls = fallbackView.decls;
          fallbackVars = fallbackView.vars;
        }
        OpList.replace(op, projection(op.handle.slot, op.projectionSlotIndex, op.attributes, fallbackViewFnName, fallbackDecls, fallbackVars, op.sourceSpan));
        break;
      case OpKind.RepeaterCreate:
        if (op.handle.slot === null) {
          throw new Error("No slot was assigned for repeater instruction");
        }
        if (!(unit instanceof ViewCompilationUnit)) {
          throw new Error(`AssertionError: must be compiling a component`);
        }
        const repeaterView = unit.job.views.get(op.xref);
        if (repeaterView.fnName === null) {
          throw new Error(`AssertionError: expected repeater primary view to have been named`);
        }
        let emptyViewFnName = null;
        let emptyDecls = null;
        let emptyVars = null;
        if (op.emptyView !== null) {
          const emptyView = unit.job.views.get(op.emptyView);
          if (emptyView === void 0) {
            throw new Error("AssertionError: repeater had empty view xref, but empty view was not found");
          }
          if (emptyView.fnName === null || emptyView.decls === null || emptyView.vars === null) {
            throw new Error(`AssertionError: expected repeater empty view to have been named and counted`);
          }
          emptyViewFnName = emptyView.fnName;
          emptyDecls = emptyView.decls;
          emptyVars = emptyView.vars;
        }
        OpList.replace(op, repeaterCreate(op.handle.slot, repeaterView.fnName, op.decls, op.vars, op.tag, op.attributes, op.trackByFn, op.usesComponentInstance, emptyViewFnName, emptyDecls, emptyVars, op.emptyTag, op.emptyAttributes, op.wholeSourceSpan));
        break;
      case OpKind.Statement:
        break;
      default:
        throw new Error(`AssertionError: Unsupported reification of create op ${OpKind[op.kind]}`);
    }
  }
}
function reifyUpdateOperations(_unit, ops) {
  for (const op of ops) {
    transformExpressionsInOp(op, reifyIrExpression, VisitorContextFlag.None);
    switch (op.kind) {
      case OpKind.Advance:
        OpList.replace(op, advance(op.delta, op.sourceSpan));
        break;
      case OpKind.Property:
        if (op.expression instanceof Interpolation) {
          OpList.replace(op, propertyInterpolate(op.name, op.expression.strings, op.expression.expressions, op.sanitizer, op.sourceSpan));
        } else {
          OpList.replace(op, property(op.name, op.expression, op.sanitizer, op.sourceSpan));
        }
        break;
      case OpKind.TwoWayProperty:
        OpList.replace(op, twoWayProperty(op.name, op.expression, op.sanitizer, op.sourceSpan));
        break;
      case OpKind.StyleProp:
        if (op.expression instanceof Interpolation) {
          OpList.replace(op, stylePropInterpolate(op.name, op.expression.strings, op.expression.expressions, op.unit, op.sourceSpan));
        } else {
          OpList.replace(op, styleProp(op.name, op.expression, op.unit, op.sourceSpan));
        }
        break;
      case OpKind.ClassProp:
        OpList.replace(op, classProp(op.name, op.expression, op.sourceSpan));
        break;
      case OpKind.StyleMap:
        if (op.expression instanceof Interpolation) {
          OpList.replace(op, styleMapInterpolate(op.expression.strings, op.expression.expressions, op.sourceSpan));
        } else {
          OpList.replace(op, styleMap(op.expression, op.sourceSpan));
        }
        break;
      case OpKind.ClassMap:
        if (op.expression instanceof Interpolation) {
          OpList.replace(op, classMapInterpolate(op.expression.strings, op.expression.expressions, op.sourceSpan));
        } else {
          OpList.replace(op, classMap(op.expression, op.sourceSpan));
        }
        break;
      case OpKind.I18nExpression:
        OpList.replace(op, i18nExp(op.expression, op.sourceSpan));
        break;
      case OpKind.I18nApply:
        OpList.replace(op, i18nApply(op.handle.slot, op.sourceSpan));
        break;
      case OpKind.InterpolateText:
        OpList.replace(op, textInterpolate(op.interpolation.strings, op.interpolation.expressions, op.sourceSpan));
        break;
      case OpKind.Attribute:
        if (op.expression instanceof Interpolation) {
          OpList.replace(op, attributeInterpolate(op.name, op.expression.strings, op.expression.expressions, op.sanitizer, op.sourceSpan));
        } else {
          OpList.replace(op, attribute(op.name, op.expression, op.sanitizer, op.namespace));
        }
        break;
      case OpKind.HostProperty:
        if (op.expression instanceof Interpolation) {
          throw new Error("not yet handled");
        } else {
          if (op.isAnimationTrigger) {
            OpList.replace(op, syntheticHostProperty(op.name, op.expression, op.sourceSpan));
          } else {
            OpList.replace(op, hostProperty(op.name, op.expression, op.sanitizer, op.sourceSpan));
          }
        }
        break;
      case OpKind.Variable:
        if (op.variable.name === null) {
          throw new Error(`AssertionError: unnamed variable ${op.xref}`);
        }
        OpList.replace(op, createStatementOp(new DeclareVarStmt(op.variable.name, op.initializer, void 0, StmtModifier.Final)));
        break;
      case OpKind.Conditional:
        if (op.processed === null) {
          throw new Error(`Conditional test was not set.`);
        }
        OpList.replace(op, conditional(op.processed, op.contextValue, op.sourceSpan));
        break;
      case OpKind.Repeater:
        OpList.replace(op, repeater(op.collection, op.sourceSpan));
        break;
      case OpKind.DeferWhen:
        OpList.replace(op, deferWhen(op.modifier, op.expr, op.sourceSpan));
        break;
      case OpKind.StoreLet:
        throw new Error(`AssertionError: unexpected storeLet ${op.declaredName}`);
      case OpKind.Statement:
        break;
      default:
        throw new Error(`AssertionError: Unsupported reification of update op ${OpKind[op.kind]}`);
    }
  }
}
function reifyIrExpression(expr) {
  if (!isIrExpression(expr)) {
    return expr;
  }
  switch (expr.kind) {
    case ExpressionKind.NextContext:
      return nextContext(expr.steps);
    case ExpressionKind.Reference:
      return reference(expr.targetSlot.slot + 1 + expr.offset);
    case ExpressionKind.LexicalRead:
      throw new Error(`AssertionError: unresolved LexicalRead of ${expr.name}`);
    case ExpressionKind.TwoWayBindingSet:
      throw new Error(`AssertionError: unresolved TwoWayBindingSet`);
    case ExpressionKind.RestoreView:
      if (typeof expr.view === "number") {
        throw new Error(`AssertionError: unresolved RestoreView`);
      }
      return restoreView(expr.view);
    case ExpressionKind.ResetView:
      return resetView(expr.expr);
    case ExpressionKind.GetCurrentView:
      return getCurrentView();
    case ExpressionKind.ReadVariable:
      if (expr.name === null) {
        throw new Error(`Read of unnamed variable ${expr.xref}`);
      }
      return variable(expr.name);
    case ExpressionKind.ReadTemporaryExpr:
      if (expr.name === null) {
        throw new Error(`Read of unnamed temporary ${expr.xref}`);
      }
      return variable(expr.name);
    case ExpressionKind.AssignTemporaryExpr:
      if (expr.name === null) {
        throw new Error(`Assign of unnamed temporary ${expr.xref}`);
      }
      return variable(expr.name).set(expr.expr);
    case ExpressionKind.PureFunctionExpr:
      if (expr.fn === null) {
        throw new Error(`AssertionError: expected PureFunctions to have been extracted`);
      }
      return pureFunction(expr.varOffset, expr.fn, expr.args);
    case ExpressionKind.PureFunctionParameterExpr:
      throw new Error(`AssertionError: expected PureFunctionParameterExpr to have been extracted`);
    case ExpressionKind.PipeBinding:
      return pipeBind(expr.targetSlot.slot, expr.varOffset, expr.args);
    case ExpressionKind.PipeBindingVariadic:
      return pipeBindV(expr.targetSlot.slot, expr.varOffset, expr.args);
    case ExpressionKind.SlotLiteralExpr:
      return literal(expr.slot.slot);
    case ExpressionKind.ContextLetReference:
      return readContextLet(expr.targetSlot.slot);
    case ExpressionKind.StoreLet:
      return storeLet(expr.value, expr.sourceSpan);
    default:
      throw new Error(`AssertionError: Unsupported reification of ir.Expression kind: ${ExpressionKind[expr.kind]}`);
  }
}
function reifyListenerHandler(unit, name, handlerOps, consumesDollarEvent) {
  reifyUpdateOperations(unit, handlerOps);
  const handlerStmts = [];
  for (const op of handlerOps) {
    if (op.kind !== OpKind.Statement) {
      throw new Error(`AssertionError: expected reified statements, but found op ${OpKind[op.kind]}`);
    }
    handlerStmts.push(op.statement);
  }
  const params = [];
  if (consumesDollarEvent) {
    params.push(new FnParam("$event"));
  }
  return fn(params, handlerStmts, void 0, void 0, name);
}
function removeEmptyBindings(job) {
  for (const unit of job.units) {
    for (const op of unit.update) {
      switch (op.kind) {
        case OpKind.Attribute:
        case OpKind.Binding:
        case OpKind.ClassProp:
        case OpKind.ClassMap:
        case OpKind.Property:
        case OpKind.StyleProp:
        case OpKind.StyleMap:
          if (op.expression instanceof EmptyExpr) {
            OpList.remove(op);
          }
          break;
      }
    }
  }
}
function removeI18nContexts(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nContext:
          OpList.remove(op);
          break;
        case OpKind.I18nStart:
          op.context = null;
          break;
      }
    }
  }
}
function removeUnusedI18nAttributesOps(job) {
  for (const unit of job.units) {
    const ownersWithI18nExpressions = /* @__PURE__ */ new Set();
    for (const op of unit.update) {
      switch (op.kind) {
        case OpKind.I18nExpression:
          ownersWithI18nExpressions.add(op.i18nOwner);
      }
    }
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nAttributes:
          if (ownersWithI18nExpressions.has(op.xref)) {
            continue;
          }
          OpList.remove(op);
      }
    }
  }
}
function resolveContexts(job) {
  for (const unit of job.units) {
    processLexicalScope$1(unit, unit.create);
    processLexicalScope$1(unit, unit.update);
  }
}
function processLexicalScope$1(view, ops) {
  const scope = /* @__PURE__ */ new Map();
  scope.set(view.xref, variable("ctx"));
  for (const op of ops) {
    switch (op.kind) {
      case OpKind.Variable:
        switch (op.variable.kind) {
          case SemanticVariableKind.Context:
            scope.set(op.variable.view, new ReadVariableExpr(op.xref));
            break;
        }
        break;
      case OpKind.Listener:
      case OpKind.TwoWayListener:
        processLexicalScope$1(view, op.handlerOps);
        break;
    }
  }
  if (view === view.job.root) {
    scope.set(view.xref, variable("ctx"));
  }
  for (const op of ops) {
    transformExpressionsInOp(op, (expr) => {
      if (expr instanceof ContextExpr) {
        if (!scope.has(expr.view)) {
          throw new Error(`No context found for reference to view ${expr.view} from view ${view.xref}`);
        }
        return scope.get(expr.view);
      } else {
        return expr;
      }
    }, VisitorContextFlag.None);
  }
}
function resolveDollarEvent(job) {
  for (const unit of job.units) {
    transformDollarEvent(unit.create);
    transformDollarEvent(unit.update);
  }
}
function transformDollarEvent(ops) {
  for (const op of ops) {
    if (op.kind === OpKind.Listener || op.kind === OpKind.TwoWayListener) {
      transformExpressionsInOp(op, (expr) => {
        if (expr instanceof LexicalReadExpr && expr.name === "$event") {
          if (op.kind === OpKind.Listener) {
            op.consumesDollarEvent = true;
          }
          return new ReadVarExpr(expr.name);
        }
        return expr;
      }, VisitorContextFlag.InChildOperation);
    }
  }
}
function resolveI18nElementPlaceholders(job) {
  const i18nContexts = /* @__PURE__ */ new Map();
  const elements = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nContext:
          i18nContexts.set(op.xref, op);
          break;
        case OpKind.ElementStart:
          elements.set(op.xref, op);
          break;
      }
    }
  }
  resolvePlaceholdersForView(job, job.root, i18nContexts, elements);
}
function resolvePlaceholdersForView(job, unit, i18nContexts, elements, pendingStructuralDirective) {
  let currentOps = null;
  let pendingStructuralDirectiveCloses = /* @__PURE__ */ new Map();
  for (const op of unit.create) {
    switch (op.kind) {
      case OpKind.I18nStart:
        if (!op.context) {
          throw Error("Could not find i18n context for i18n op");
        }
        currentOps = { i18nBlock: op, i18nContext: i18nContexts.get(op.context) };
        break;
      case OpKind.I18nEnd:
        currentOps = null;
        break;
      case OpKind.ElementStart:
        if (op.i18nPlaceholder !== void 0) {
          if (currentOps === null) {
            throw Error("i18n tag placeholder should only occur inside an i18n block");
          }
          recordElementStart(op, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
          if (pendingStructuralDirective && op.i18nPlaceholder.closeName) {
            pendingStructuralDirectiveCloses.set(op.xref, pendingStructuralDirective);
          }
          pendingStructuralDirective = void 0;
        }
        break;
      case OpKind.ElementEnd:
        const startOp = elements.get(op.xref);
        if (startOp && startOp.i18nPlaceholder !== void 0) {
          if (currentOps === null) {
            throw Error("AssertionError: i18n tag placeholder should only occur inside an i18n block");
          }
          recordElementClose(startOp, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirectiveCloses.get(op.xref));
          pendingStructuralDirectiveCloses.delete(op.xref);
        }
        break;
      case OpKind.Projection:
        if (op.i18nPlaceholder !== void 0) {
          if (currentOps === null) {
            throw Error("i18n tag placeholder should only occur inside an i18n block");
          }
          recordElementStart(op, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
          recordElementClose(op, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
          pendingStructuralDirective = void 0;
        }
        break;
      case OpKind.Template:
        const view = job.views.get(op.xref);
        if (op.i18nPlaceholder === void 0) {
          resolvePlaceholdersForView(job, view, i18nContexts, elements);
        } else {
          if (currentOps === null) {
            throw Error("i18n tag placeholder should only occur inside an i18n block");
          }
          if (op.templateKind === TemplateKind.Structural) {
            resolvePlaceholdersForView(job, view, i18nContexts, elements, op);
          } else {
            recordTemplateStart(job, view, op.handle.slot, op.i18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
            resolvePlaceholdersForView(job, view, i18nContexts, elements);
            recordTemplateClose(job, view, op.handle.slot, op.i18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
            pendingStructuralDirective = void 0;
          }
        }
        break;
      case OpKind.RepeaterCreate:
        if (pendingStructuralDirective !== void 0) {
          throw Error("AssertionError: Unexpected structural directive associated with @for block");
        }
        const forSlot = op.handle.slot + 1;
        const forView = job.views.get(op.xref);
        if (op.i18nPlaceholder === void 0) {
          resolvePlaceholdersForView(job, forView, i18nContexts, elements);
        } else {
          if (currentOps === null) {
            throw Error("i18n tag placeholder should only occur inside an i18n block");
          }
          recordTemplateStart(job, forView, forSlot, op.i18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
          resolvePlaceholdersForView(job, forView, i18nContexts, elements);
          recordTemplateClose(job, forView, forSlot, op.i18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
          pendingStructuralDirective = void 0;
        }
        if (op.emptyView !== null) {
          const emptySlot = op.handle.slot + 2;
          const emptyView = job.views.get(op.emptyView);
          if (op.emptyI18nPlaceholder === void 0) {
            resolvePlaceholdersForView(job, emptyView, i18nContexts, elements);
          } else {
            if (currentOps === null) {
              throw Error("i18n tag placeholder should only occur inside an i18n block");
            }
            recordTemplateStart(job, emptyView, emptySlot, op.emptyI18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
            resolvePlaceholdersForView(job, emptyView, i18nContexts, elements);
            recordTemplateClose(job, emptyView, emptySlot, op.emptyI18nPlaceholder, currentOps.i18nContext, currentOps.i18nBlock, pendingStructuralDirective);
            pendingStructuralDirective = void 0;
          }
        }
        break;
    }
  }
}
function recordElementStart(op, i18nContext, i18nBlock, structuralDirective) {
  const { startName, closeName } = op.i18nPlaceholder;
  let flags = I18nParamValueFlags.ElementTag | I18nParamValueFlags.OpenTag;
  let value = op.handle.slot;
  if (structuralDirective !== void 0) {
    flags |= I18nParamValueFlags.TemplateTag;
    value = { element: value, template: structuralDirective.handle.slot };
  }
  if (!closeName) {
    flags |= I18nParamValueFlags.CloseTag;
  }
  addParam(i18nContext.params, startName, value, i18nBlock.subTemplateIndex, flags);
}
function recordElementClose(op, i18nContext, i18nBlock, structuralDirective) {
  const { closeName } = op.i18nPlaceholder;
  if (closeName) {
    let flags = I18nParamValueFlags.ElementTag | I18nParamValueFlags.CloseTag;
    let value = op.handle.slot;
    if (structuralDirective !== void 0) {
      flags |= I18nParamValueFlags.TemplateTag;
      value = { element: value, template: structuralDirective.handle.slot };
    }
    addParam(i18nContext.params, closeName, value, i18nBlock.subTemplateIndex, flags);
  }
}
function recordTemplateStart(job, view, slot, i18nPlaceholder, i18nContext, i18nBlock, structuralDirective) {
  let { startName, closeName } = i18nPlaceholder;
  let flags = I18nParamValueFlags.TemplateTag | I18nParamValueFlags.OpenTag;
  if (!closeName) {
    flags |= I18nParamValueFlags.CloseTag;
  }
  if (structuralDirective !== void 0) {
    addParam(i18nContext.params, startName, structuralDirective.handle.slot, i18nBlock.subTemplateIndex, flags);
  }
  addParam(i18nContext.params, startName, slot, getSubTemplateIndexForTemplateTag(job, i18nBlock, view), flags);
}
function recordTemplateClose(job, view, slot, i18nPlaceholder, i18nContext, i18nBlock, structuralDirective) {
  const { closeName } = i18nPlaceholder;
  const flags = I18nParamValueFlags.TemplateTag | I18nParamValueFlags.CloseTag;
  if (closeName) {
    addParam(i18nContext.params, closeName, slot, getSubTemplateIndexForTemplateTag(job, i18nBlock, view), flags);
    if (structuralDirective !== void 0) {
      addParam(i18nContext.params, closeName, structuralDirective.handle.slot, i18nBlock.subTemplateIndex, flags);
    }
  }
}
function getSubTemplateIndexForTemplateTag(job, i18nOp, view) {
  for (const childOp of view.create) {
    if (childOp.kind === OpKind.I18nStart) {
      return childOp.subTemplateIndex;
    }
  }
  return i18nOp.subTemplateIndex;
}
function addParam(params, placeholder, value, subTemplateIndex, flags) {
  const values = params.get(placeholder) ?? [];
  values.push({ value, subTemplateIndex, flags });
  params.set(placeholder, values);
}
function resolveI18nExpressionPlaceholders(job) {
  const subTemplateIndices = /* @__PURE__ */ new Map();
  const i18nContexts = /* @__PURE__ */ new Map();
  const icuPlaceholders = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nStart:
          subTemplateIndices.set(op.xref, op.subTemplateIndex);
          break;
        case OpKind.I18nContext:
          i18nContexts.set(op.xref, op);
          break;
        case OpKind.IcuPlaceholder:
          icuPlaceholders.set(op.xref, op);
          break;
      }
    }
  }
  const expressionIndices = /* @__PURE__ */ new Map();
  const referenceIndex = (op) => op.usage === I18nExpressionFor.I18nText ? op.i18nOwner : op.context;
  for (const unit of job.units) {
    for (const op of unit.update) {
      if (op.kind === OpKind.I18nExpression) {
        const index = expressionIndices.get(referenceIndex(op)) || 0;
        const subTemplateIndex = subTemplateIndices.get(op.i18nOwner) ?? null;
        const value = {
          value: index,
          subTemplateIndex,
          flags: I18nParamValueFlags.ExpressionIndex
        };
        updatePlaceholder(op, value, i18nContexts, icuPlaceholders);
        expressionIndices.set(referenceIndex(op), index + 1);
      }
    }
  }
}
function updatePlaceholder(op, value, i18nContexts, icuPlaceholders) {
  if (op.i18nPlaceholder !== null) {
    const i18nContext = i18nContexts.get(op.context);
    const params = op.resolutionTime === I18nParamResolutionTime.Creation ? i18nContext.params : i18nContext.postprocessingParams;
    const values = params.get(op.i18nPlaceholder) || [];
    values.push(value);
    params.set(op.i18nPlaceholder, values);
  }
  if (op.icuPlaceholder !== null) {
    const icuPlaceholderOp = icuPlaceholders.get(op.icuPlaceholder);
    icuPlaceholderOp?.expressionPlaceholders.push(value);
  }
}
function resolveNames(job) {
  for (const unit of job.units) {
    processLexicalScope(unit, unit.create, null);
    processLexicalScope(unit, unit.update, null);
  }
}
function processLexicalScope(unit, ops, savedView) {
  const scope = /* @__PURE__ */ new Map();
  const localDefinitions = /* @__PURE__ */ new Map();
  for (const op of ops) {
    switch (op.kind) {
      case OpKind.Variable:
        switch (op.variable.kind) {
          case SemanticVariableKind.Identifier:
            if (op.variable.local) {
              if (localDefinitions.has(op.variable.identifier)) {
                continue;
              }
              localDefinitions.set(op.variable.identifier, op.xref);
            } else if (scope.has(op.variable.identifier)) {
              continue;
            }
            scope.set(op.variable.identifier, op.xref);
            break;
          case SemanticVariableKind.Alias:
            if (scope.has(op.variable.identifier)) {
              continue;
            }
            scope.set(op.variable.identifier, op.xref);
            break;
          case SemanticVariableKind.SavedView:
            savedView = {
              view: op.variable.view,
              variable: op.xref
            };
            break;
        }
        break;
      case OpKind.Listener:
      case OpKind.TwoWayListener:
        processLexicalScope(unit, op.handlerOps, savedView);
        break;
    }
  }
  for (const op of ops) {
    if (op.kind == OpKind.Listener || op.kind === OpKind.TwoWayListener) {
      continue;
    }
    transformExpressionsInOp(op, (expr) => {
      if (expr instanceof LexicalReadExpr) {
        if (localDefinitions.has(expr.name)) {
          return new ReadVariableExpr(localDefinitions.get(expr.name));
        } else if (scope.has(expr.name)) {
          return new ReadVariableExpr(scope.get(expr.name));
        } else {
          return new ReadPropExpr(new ContextExpr(unit.job.root.xref), expr.name);
        }
      } else if (expr instanceof RestoreViewExpr && typeof expr.view === "number") {
        if (savedView === null || savedView.view !== expr.view) {
          throw new Error(`AssertionError: no saved view ${expr.view} from view ${unit.xref}`);
        }
        expr.view = new ReadVariableExpr(savedView.variable);
        return expr;
      } else {
        return expr;
      }
    }, VisitorContextFlag.None);
  }
  for (const op of ops) {
    visitExpressionsInOp(op, (expr) => {
      if (expr instanceof LexicalReadExpr) {
        throw new Error(`AssertionError: no lexical reads should remain, but found read of ${expr.name}`);
      }
    });
  }
}
const sanitizerFns = /* @__PURE__ */ new Map([
  [SecurityContext.HTML, Identifiers.sanitizeHtml],
  [SecurityContext.RESOURCE_URL, Identifiers.sanitizeResourceUrl],
  [SecurityContext.SCRIPT, Identifiers.sanitizeScript],
  [SecurityContext.STYLE, Identifiers.sanitizeStyle],
  [SecurityContext.URL, Identifiers.sanitizeUrl]
]);
const trustedValueFns = /* @__PURE__ */ new Map([
  [SecurityContext.HTML, Identifiers.trustConstantHtml],
  [SecurityContext.RESOURCE_URL, Identifiers.trustConstantResourceUrl]
]);
function resolveSanitizers(job) {
  for (const unit of job.units) {
    const elements = createOpXrefMap(unit);
    if (job.kind !== CompilationJobKind.Host) {
      for (const op of unit.create) {
        if (op.kind === OpKind.ExtractedAttribute) {
          const trustedValueFn = trustedValueFns.get(getOnlySecurityContext(op.securityContext)) ?? null;
          op.trustedValueFn = trustedValueFn !== null ? importExpr(trustedValueFn) : null;
        }
      }
    }
    for (const op of unit.update) {
      switch (op.kind) {
        case OpKind.Property:
        case OpKind.Attribute:
        case OpKind.HostProperty:
          let sanitizerFn = null;
          if (Array.isArray(op.securityContext) && op.securityContext.length === 2 && op.securityContext.indexOf(SecurityContext.URL) > -1 && op.securityContext.indexOf(SecurityContext.RESOURCE_URL) > -1) {
            sanitizerFn = Identifiers.sanitizeUrlOrResourceUrl;
          } else {
            sanitizerFn = sanitizerFns.get(getOnlySecurityContext(op.securityContext)) ?? null;
          }
          op.sanitizer = sanitizerFn !== null ? importExpr(sanitizerFn) : null;
          if (op.sanitizer === null) {
            let isIframe = false;
            if (job.kind === CompilationJobKind.Host || op.kind === OpKind.HostProperty) {
              isIframe = true;
            } else {
              const ownerOp = elements.get(op.target);
              if (ownerOp === void 0 || !isElementOrContainerOp(ownerOp)) {
                throw Error("Property should have an element-like owner");
              }
              isIframe = isIframeElement(ownerOp);
            }
            if (isIframe && isIframeSecuritySensitiveAttr(op.name)) {
              op.sanitizer = importExpr(Identifiers.validateIframeAttribute);
            }
          }
          break;
      }
    }
  }
}
function isIframeElement(op) {
  return op.kind === OpKind.ElementStart && op.tag?.toLowerCase() === "iframe";
}
function getOnlySecurityContext(securityContext) {
  if (Array.isArray(securityContext)) {
    if (securityContext.length > 1) {
      throw Error(`AssertionError: Ambiguous security context`);
    }
    return securityContext[0] || SecurityContext.NONE;
  }
  return securityContext;
}
function transformTwoWayBindingSet(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind === OpKind.TwoWayListener) {
        transformExpressionsInOp(op, (expr) => {
          if (!(expr instanceof TwoWayBindingSetExpr)) {
            return expr;
          }
          const { target, value } = expr;
          if (target instanceof ReadPropExpr || target instanceof ReadKeyExpr) {
            return twoWayBindingSet(target, value).or(target.set(value));
          }
          if (target instanceof ReadVariableExpr) {
            return twoWayBindingSet(target, value);
          }
          throw new Error(`Unsupported expression in two-way action binding.`);
        }, VisitorContextFlag.InChildOperation);
      }
    }
  }
}
function saveAndRestoreView(job) {
  for (const unit of job.units) {
    unit.create.prepend([
      createVariableOp(unit.job.allocateXrefId(), {
        kind: SemanticVariableKind.SavedView,
        name: null,
        view: unit.xref
      }, new GetCurrentViewExpr(), VariableFlags.None)
    ]);
    for (const op of unit.create) {
      if (op.kind !== OpKind.Listener && op.kind !== OpKind.TwoWayListener) {
        continue;
      }
      let needsRestoreView = unit !== job.root;
      if (!needsRestoreView) {
        for (const handlerOp of op.handlerOps) {
          visitExpressionsInOp(handlerOp, (expr) => {
            if (expr instanceof ReferenceExpr || expr instanceof ContextLetReferenceExpr) {
              needsRestoreView = true;
            }
          });
        }
      }
      if (needsRestoreView) {
        addSaveRestoreViewOperationToListener(unit, op);
      }
    }
  }
}
function addSaveRestoreViewOperationToListener(unit, op) {
  op.handlerOps.prepend([
    createVariableOp(unit.job.allocateXrefId(), {
      kind: SemanticVariableKind.Context,
      name: null,
      view: unit.xref
    }, new RestoreViewExpr(unit.xref), VariableFlags.None)
  ]);
  for (const handlerOp of op.handlerOps) {
    if (handlerOp.kind === OpKind.Statement && handlerOp.statement instanceof ReturnStatement) {
      handlerOp.statement.value = new ResetViewExpr(handlerOp.statement.value);
    }
  }
}
function allocateSlots(job) {
  const slotMap = /* @__PURE__ */ new Map();
  for (const unit of job.units) {
    let slotCount = 0;
    for (const op of unit.create) {
      if (!hasConsumesSlotTrait(op)) {
        continue;
      }
      op.handle.slot = slotCount;
      slotMap.set(op.xref, op.handle.slot);
      slotCount += op.numSlotsUsed;
    }
    unit.decls = slotCount;
  }
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      if (op.kind === OpKind.Template || op.kind === OpKind.RepeaterCreate) {
        const childView = job.views.get(op.xref);
        op.decls = childView.decls;
      }
    }
  }
}
function specializeStyleBindings(job) {
  for (const unit of job.units) {
    for (const op of unit.update) {
      if (op.kind !== OpKind.Binding) {
        continue;
      }
      switch (op.bindingKind) {
        case BindingKind.ClassName:
          if (op.expression instanceof Interpolation) {
            throw new Error(`Unexpected interpolation in ClassName binding`);
          }
          OpList.replace(op, createClassPropOp(op.target, op.name, op.expression, op.sourceSpan));
          break;
        case BindingKind.StyleProperty:
          OpList.replace(op, createStylePropOp(op.target, op.name, op.expression, op.unit, op.sourceSpan));
          break;
        case BindingKind.Property:
        case BindingKind.Template:
          if (op.name === "style") {
            OpList.replace(op, createStyleMapOp(op.target, op.expression, op.sourceSpan));
          } else if (op.name === "class") {
            OpList.replace(op, createClassMapOp(op.target, op.expression, op.sourceSpan));
          }
          break;
      }
    }
  }
}
function generateTemporaryVariables(job) {
  for (const unit of job.units) {
    unit.create.prepend(generateTemporaries(unit.create));
    unit.update.prepend(generateTemporaries(unit.update));
  }
}
function generateTemporaries(ops) {
  let opCount = 0;
  let generatedStatements = [];
  for (const op of ops) {
    const finalReads = /* @__PURE__ */ new Map();
    visitExpressionsInOp(op, (expr, flag) => {
      if (flag & VisitorContextFlag.InChildOperation) {
        return;
      }
      if (expr instanceof ReadTemporaryExpr) {
        finalReads.set(expr.xref, expr);
      }
    });
    let count = 0;
    const assigned = /* @__PURE__ */ new Set();
    const released = /* @__PURE__ */ new Set();
    const defs = /* @__PURE__ */ new Map();
    visitExpressionsInOp(op, (expr, flag) => {
      if (flag & VisitorContextFlag.InChildOperation) {
        return;
      }
      if (expr instanceof AssignTemporaryExpr) {
        if (!assigned.has(expr.xref)) {
          assigned.add(expr.xref);
          defs.set(expr.xref, `tmp_${opCount}_${count++}`);
        }
        assignName(defs, expr);
      } else if (expr instanceof ReadTemporaryExpr) {
        if (finalReads.get(expr.xref) === expr) {
          released.add(expr.xref);
          count--;
        }
        assignName(defs, expr);
      }
    });
    generatedStatements.push(...Array.from(new Set(defs.values())).map((name) => createStatementOp(new DeclareVarStmt(name))));
    opCount++;
    if (op.kind === OpKind.Listener || op.kind === OpKind.TwoWayListener) {
      op.handlerOps.prepend(generateTemporaries(op.handlerOps));
    }
  }
  return generatedStatements;
}
function assignName(names, expr) {
  const name = names.get(expr.xref);
  if (name === void 0) {
    throw new Error(`Found xref with unassigned name: ${expr.xref}`);
  }
  expr.name = name;
}
function generateTrackFns(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind !== OpKind.RepeaterCreate) {
        continue;
      }
      if (op.trackByFn !== null) {
        continue;
      }
      let usesComponentContext = false;
      op.track = transformExpressionsInExpression(op.track, (expr) => {
        if (expr instanceof PipeBindingExpr || expr instanceof PipeBindingVariadicExpr) {
          throw new Error(`Illegal State: Pipes are not allowed in this context`);
        }
        if (expr instanceof TrackContextExpr) {
          usesComponentContext = true;
          return variable("this");
        }
        return expr;
      }, VisitorContextFlag.None);
      let fn2;
      const fnParams = [new FnParam("$index"), new FnParam("$item")];
      if (usesComponentContext) {
        fn2 = new FunctionExpr(fnParams, [new ReturnStatement(op.track)]);
      } else {
        fn2 = arrowFn(fnParams, op.track);
      }
      op.trackByFn = job.pool.getSharedFunctionReference(fn2, "_forTrack");
    }
  }
}
function optimizeTrackFns(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind !== OpKind.RepeaterCreate) {
        continue;
      }
      if (op.track instanceof ReadVarExpr && op.track.name === "$index") {
        op.trackByFn = importExpr(Identifiers.repeaterTrackByIndex);
      } else if (op.track instanceof ReadVarExpr && op.track.name === "$item") {
        op.trackByFn = importExpr(Identifiers.repeaterTrackByIdentity);
      } else if (isTrackByFunctionCall(job.root.xref, op.track)) {
        op.usesComponentInstance = true;
        if (op.track.receiver.receiver.view === unit.xref) {
          op.trackByFn = op.track.receiver;
        } else {
          op.trackByFn = importExpr(Identifiers.componentInstance).callFn([]).prop(op.track.receiver.name);
          op.track = op.trackByFn;
        }
      } else {
        op.track = transformExpressionsInExpression(op.track, (expr) => {
          if (expr instanceof ContextExpr) {
            op.usesComponentInstance = true;
            return new TrackContextExpr(expr.view);
          }
          return expr;
        }, VisitorContextFlag.None);
      }
    }
  }
}
function isTrackByFunctionCall(rootView, expr) {
  if (!(expr instanceof InvokeFunctionExpr) || expr.args.length === 0 || expr.args.length > 2) {
    return false;
  }
  if (!(expr.receiver instanceof ReadPropExpr && expr.receiver.receiver instanceof ContextExpr) || expr.receiver.receiver.view !== rootView) {
    return false;
  }
  const [arg0, arg1] = expr.args;
  if (!(arg0 instanceof ReadVarExpr) || arg0.name !== "$index") {
    return false;
  } else if (expr.args.length === 1) {
    return true;
  }
  if (!(arg1 instanceof ReadVarExpr) || arg1.name !== "$item") {
    return false;
  }
  return true;
}
function generateTrackVariables(job) {
  for (const unit of job.units) {
    for (const op of unit.create) {
      if (op.kind !== OpKind.RepeaterCreate) {
        continue;
      }
      op.track = transformExpressionsInExpression(op.track, (expr) => {
        if (expr instanceof LexicalReadExpr) {
          if (op.varNames.$index.has(expr.name)) {
            return variable("$index");
          } else if (expr.name === op.varNames.$implicit) {
            return variable("$item");
          }
        }
        return expr;
      }, VisitorContextFlag.None);
    }
  }
}
function countVariables(job) {
  for (const unit of job.units) {
    let varCount = 0;
    for (const op of unit.ops()) {
      if (hasConsumesVarsTrait(op)) {
        varCount += varsUsedByOp(op);
      }
    }
    for (const op of unit.ops()) {
      visitExpressionsInOp(op, (expr) => {
        if (!isIrExpression(expr)) {
          return;
        }
        if (job.compatibility === CompatibilityMode.TemplateDefinitionBuilder && expr instanceof PureFunctionExpr) {
          return;
        }
        if (hasUsesVarOffsetTrait(expr)) {
          expr.varOffset = varCount;
        }
        if (hasConsumesVarsTrait(expr)) {
          varCount += varsUsedByIrExpression(expr);
        }
      });
    }
    if (job.compatibility === CompatibilityMode.TemplateDefinitionBuilder) {
      for (const op of unit.ops()) {
        visitExpressionsInOp(op, (expr) => {
          if (!isIrExpression(expr) || !(expr instanceof PureFunctionExpr)) {
            return;
          }
          if (hasUsesVarOffsetTrait(expr)) {
            expr.varOffset = varCount;
          }
          if (hasConsumesVarsTrait(expr)) {
            varCount += varsUsedByIrExpression(expr);
          }
        });
      }
    }
    unit.vars = varCount;
  }
  if (job instanceof ComponentCompilationJob) {
    for (const unit of job.units) {
      for (const op of unit.create) {
        if (op.kind !== OpKind.Template && op.kind !== OpKind.RepeaterCreate) {
          continue;
        }
        const childView = job.views.get(op.xref);
        op.vars = childView.vars;
      }
    }
  }
}
function varsUsedByOp(op) {
  let slots;
  switch (op.kind) {
    case OpKind.Property:
    case OpKind.HostProperty:
    case OpKind.Attribute:
      slots = 1;
      if (op.expression instanceof Interpolation && !isSingletonInterpolation(op.expression)) {
        slots += op.expression.expressions.length;
      }
      return slots;
    case OpKind.TwoWayProperty:
      return 1;
    case OpKind.StyleProp:
    case OpKind.ClassProp:
    case OpKind.StyleMap:
    case OpKind.ClassMap:
      slots = 2;
      if (op.expression instanceof Interpolation) {
        slots += op.expression.expressions.length;
      }
      return slots;
    case OpKind.InterpolateText:
      return op.interpolation.expressions.length;
    case OpKind.I18nExpression:
    case OpKind.Conditional:
    case OpKind.DeferWhen:
    case OpKind.StoreLet:
      return 1;
    case OpKind.RepeaterCreate:
      return op.emptyView ? 1 : 0;
    default:
      throw new Error(`Unhandled op: ${OpKind[op.kind]}`);
  }
}
function varsUsedByIrExpression(expr) {
  switch (expr.kind) {
    case ExpressionKind.PureFunctionExpr:
      return 1 + expr.args.length;
    case ExpressionKind.PipeBinding:
      return 1 + expr.args.length;
    case ExpressionKind.PipeBindingVariadic:
      return 1 + expr.numArgs;
    case ExpressionKind.StoreLet:
      return 1;
    default:
      throw new Error(`AssertionError: unhandled ConsumesVarsTrait expression ${expr.constructor.name}`);
  }
}
function isSingletonInterpolation(expr) {
  if (expr.expressions.length !== 1 || expr.strings.length !== 2) {
    return false;
  }
  if (expr.strings[0] !== "" || expr.strings[1] !== "") {
    return false;
  }
  return true;
}
function optimizeVariables(job) {
  for (const unit of job.units) {
    inlineAlwaysInlineVariables(unit.create);
    inlineAlwaysInlineVariables(unit.update);
    for (const op of unit.create) {
      if (op.kind === OpKind.Listener || op.kind === OpKind.TwoWayListener) {
        inlineAlwaysInlineVariables(op.handlerOps);
      }
    }
    optimizeVariablesInOpList(unit.create, job.compatibility);
    optimizeVariablesInOpList(unit.update, job.compatibility);
    for (const op of unit.create) {
      if (op.kind === OpKind.Listener || op.kind === OpKind.TwoWayListener) {
        optimizeVariablesInOpList(op.handlerOps, job.compatibility);
      }
    }
  }
}
var Fence;
(function(Fence2) {
  Fence2[Fence2["None"] = 0] = "None";
  Fence2[Fence2["ViewContextRead"] = 1] = "ViewContextRead";
  Fence2[Fence2["ViewContextWrite"] = 2] = "ViewContextWrite";
  Fence2[Fence2["SideEffectful"] = 4] = "SideEffectful";
})(Fence || (Fence = {}));
function inlineAlwaysInlineVariables(ops) {
  const vars = /* @__PURE__ */ new Map();
  for (const op of ops) {
    if (op.kind === OpKind.Variable && op.flags & VariableFlags.AlwaysInline) {
      visitExpressionsInOp(op, (expr) => {
        if (isIrExpression(expr) && fencesForIrExpression(expr) !== Fence.None) {
          throw new Error(`AssertionError: A context-sensitive variable was marked AlwaysInline`);
        }
      });
      vars.set(op.xref, op);
    }
    transformExpressionsInOp(op, (expr) => {
      if (expr instanceof ReadVariableExpr && vars.has(expr.xref)) {
        const varOp = vars.get(expr.xref);
        return varOp.initializer.clone();
      }
      return expr;
    }, VisitorContextFlag.None);
  }
  for (const op of vars.values()) {
    OpList.remove(op);
  }
}
function optimizeVariablesInOpList(ops, compatibility) {
  const varDecls = /* @__PURE__ */ new Map();
  const varUsages = /* @__PURE__ */ new Map();
  const varRemoteUsages = /* @__PURE__ */ new Set();
  const opMap = /* @__PURE__ */ new Map();
  for (const op of ops) {
    if (op.kind === OpKind.Variable) {
      if (varDecls.has(op.xref) || varUsages.has(op.xref)) {
        throw new Error(`Should not see two declarations of the same variable: ${op.xref}`);
      }
      varDecls.set(op.xref, op);
      varUsages.set(op.xref, 0);
    }
    opMap.set(op, collectOpInfo(op));
    countVariableUsages(op, varUsages, varRemoteUsages);
  }
  let contextIsUsed = false;
  for (const op of ops.reversed()) {
    const opInfo = opMap.get(op);
    if (op.kind === OpKind.Variable && varUsages.get(op.xref) === 0) {
      if (contextIsUsed && opInfo.fences & Fence.ViewContextWrite || opInfo.fences & Fence.SideEffectful) {
        const stmtOp = createStatementOp(op.initializer.toStmt());
        opMap.set(stmtOp, opInfo);
        OpList.replace(op, stmtOp);
      } else {
        uncountVariableUsages(op, varUsages);
        OpList.remove(op);
      }
      opMap.delete(op);
      varDecls.delete(op.xref);
      varUsages.delete(op.xref);
      continue;
    }
    if (opInfo.fences & Fence.ViewContextRead) {
      contextIsUsed = true;
    }
  }
  const toInline = [];
  for (const [id, count] of varUsages) {
    const decl = varDecls.get(id);
    const isAlwaysInline = !!(decl.flags & VariableFlags.AlwaysInline);
    if (count !== 1 || isAlwaysInline) {
      continue;
    }
    if (varRemoteUsages.has(id)) {
      continue;
    }
    toInline.push(id);
  }
  let candidate;
  while (candidate = toInline.pop()) {
    const decl = varDecls.get(candidate);
    const varInfo = opMap.get(decl);
    const isAlwaysInline = !!(decl.flags & VariableFlags.AlwaysInline);
    if (isAlwaysInline) {
      throw new Error(`AssertionError: Found an 'AlwaysInline' variable after the always inlining pass.`);
    }
    for (let targetOp = decl.next; targetOp.kind !== OpKind.ListEnd; targetOp = targetOp.next) {
      const opInfo = opMap.get(targetOp);
      if (opInfo.variablesUsed.has(candidate)) {
        if (compatibility === CompatibilityMode.TemplateDefinitionBuilder && !allowConservativeInlining(decl, targetOp)) {
          break;
        }
        if (tryInlineVariableInitializer(candidate, decl.initializer, targetOp, varInfo.fences)) {
          opInfo.variablesUsed.delete(candidate);
          for (const id of varInfo.variablesUsed) {
            opInfo.variablesUsed.add(id);
          }
          opInfo.fences |= varInfo.fences;
          varDecls.delete(candidate);
          varUsages.delete(candidate);
          opMap.delete(decl);
          OpList.remove(decl);
        }
        break;
      }
      if (!safeToInlinePastFences(opInfo.fences, varInfo.fences)) {
        break;
      }
    }
  }
}
function fencesForIrExpression(expr) {
  switch (expr.kind) {
    case ExpressionKind.NextContext:
      return Fence.ViewContextRead | Fence.ViewContextWrite;
    case ExpressionKind.RestoreView:
      return Fence.ViewContextRead | Fence.ViewContextWrite | Fence.SideEffectful;
    case ExpressionKind.StoreLet:
      return Fence.SideEffectful;
    case ExpressionKind.Reference:
    case ExpressionKind.ContextLetReference:
      return Fence.ViewContextRead;
    default:
      return Fence.None;
  }
}
function collectOpInfo(op) {
  let fences = Fence.None;
  const variablesUsed = /* @__PURE__ */ new Set();
  visitExpressionsInOp(op, (expr) => {
    if (!isIrExpression(expr)) {
      return;
    }
    switch (expr.kind) {
      case ExpressionKind.ReadVariable:
        variablesUsed.add(expr.xref);
        break;
      default:
        fences |= fencesForIrExpression(expr);
    }
  });
  return { fences, variablesUsed };
}
function countVariableUsages(op, varUsages, varRemoteUsage) {
  visitExpressionsInOp(op, (expr, flags) => {
    if (!isIrExpression(expr)) {
      return;
    }
    if (expr.kind !== ExpressionKind.ReadVariable) {
      return;
    }
    const count = varUsages.get(expr.xref);
    if (count === void 0) {
      return;
    }
    varUsages.set(expr.xref, count + 1);
    if (flags & VisitorContextFlag.InChildOperation) {
      varRemoteUsage.add(expr.xref);
    }
  });
}
function uncountVariableUsages(op, varUsages) {
  visitExpressionsInOp(op, (expr) => {
    if (!isIrExpression(expr)) {
      return;
    }
    if (expr.kind !== ExpressionKind.ReadVariable) {
      return;
    }
    const count = varUsages.get(expr.xref);
    if (count === void 0) {
      return;
    } else if (count === 0) {
      throw new Error(`Inaccurate variable count: ${expr.xref} - found another read but count is already 0`);
    }
    varUsages.set(expr.xref, count - 1);
  });
}
function safeToInlinePastFences(fences, declFences) {
  if (fences & Fence.ViewContextWrite) {
    if (declFences & Fence.ViewContextRead) {
      return false;
    }
  } else if (fences & Fence.ViewContextRead) {
    if (declFences & Fence.ViewContextWrite) {
      return false;
    }
  }
  return true;
}
function tryInlineVariableInitializer(id, initializer, target, declFences) {
  let inlined = false;
  let inliningAllowed = true;
  transformExpressionsInOp(target, (expr, flags) => {
    if (!isIrExpression(expr)) {
      return expr;
    }
    if (inlined || !inliningAllowed) {
      return expr;
    } else if (flags & VisitorContextFlag.InChildOperation && declFences & Fence.ViewContextRead) {
      return expr;
    }
    switch (expr.kind) {
      case ExpressionKind.ReadVariable:
        if (expr.xref === id) {
          inlined = true;
          return initializer;
        }
        break;
      default:
        const exprFences = fencesForIrExpression(expr);
        inliningAllowed = inliningAllowed && safeToInlinePastFences(exprFences, declFences);
        break;
    }
    return expr;
  }, VisitorContextFlag.None);
  return inlined;
}
function allowConservativeInlining(decl, target) {
  switch (decl.variable.kind) {
    case SemanticVariableKind.Identifier:
      if (decl.initializer instanceof ReadVarExpr && decl.initializer.name === "ctx") {
        return true;
      }
      return false;
    case SemanticVariableKind.Context:
      return target.kind === OpKind.Variable;
    default:
      return true;
  }
}
function wrapI18nIcus(job) {
  for (const unit of job.units) {
    let currentI18nOp = null;
    let addedI18nId = null;
    for (const op of unit.create) {
      switch (op.kind) {
        case OpKind.I18nStart:
          currentI18nOp = op;
          break;
        case OpKind.I18nEnd:
          currentI18nOp = null;
          break;
        case OpKind.IcuStart:
          if (currentI18nOp === null) {
            addedI18nId = job.allocateXrefId();
            OpList.insertBefore(createI18nStartOp(addedI18nId, op.message, void 0, null), op);
          }
          break;
        case OpKind.IcuEnd:
          if (addedI18nId !== null) {
            OpList.insertAfter(createI18nEndOp(addedI18nId, null), op);
            addedI18nId = null;
          }
          break;
      }
    }
  }
}
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
function optimizeStoreLet(job) {
  const letUsedExternally = /* @__PURE__ */ new Set();
  for (const unit of job.units) {
    for (const op of unit.ops()) {
      visitExpressionsInOp(op, (expr) => {
        if (expr instanceof ContextLetReferenceExpr) {
          letUsedExternally.add(expr.target);
        }
      });
    }
  }
  for (const unit of job.units) {
    for (const op of unit.update) {
      transformExpressionsInOp(op, (expression) => expression instanceof StoreLetExpr && !letUsedExternally.has(expression.target) ? expression.value : expression, VisitorContextFlag.None);
    }
  }
}
function removeIllegalLetReferences(job) {
  for (const unit of job.units) {
    for (const op of unit.update) {
      if (op.kind !== OpKind.Variable || op.variable.kind !== SemanticVariableKind.Identifier || !(op.initializer instanceof StoreLetExpr)) {
        continue;
      }
      const name = op.variable.identifier;
      let current = op;
      while (current && current.kind !== OpKind.ListEnd) {
        transformExpressionsInOp(current, (expr) => expr instanceof LexicalReadExpr && expr.name === name ? literal(void 0) : expr, VisitorContextFlag.None);
        current = current.prev;
      }
    }
  }
}
function generateLocalLetReferences(job) {
  for (const unit of job.units) {
    for (const op of unit.update) {
      if (op.kind !== OpKind.StoreLet) {
        continue;
      }
      const variable2 = {
        kind: SemanticVariableKind.Identifier,
        name: null,
        identifier: op.declaredName,
        local: true
      };
      OpList.replace(op, createVariableOp(job.allocateXrefId(), variable2, new StoreLetExpr(op.target, op.value, op.sourceSpan), VariableFlags.None));
    }
  }
}
/**
 *
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
const phases = [
  { kind: CompilationJobKind.Tmpl, fn: removeContentSelectors },
  { kind: CompilationJobKind.Host, fn: parseHostStyleProperties },
  { kind: CompilationJobKind.Tmpl, fn: emitNamespaceChanges },
  { kind: CompilationJobKind.Tmpl, fn: propagateI18nBlocks },
  { kind: CompilationJobKind.Tmpl, fn: wrapI18nIcus },
  { kind: CompilationJobKind.Both, fn: deduplicateTextBindings },
  { kind: CompilationJobKind.Both, fn: specializeStyleBindings },
  { kind: CompilationJobKind.Both, fn: specializeBindings },
  { kind: CompilationJobKind.Both, fn: extractAttributes },
  { kind: CompilationJobKind.Tmpl, fn: createI18nContexts },
  { kind: CompilationJobKind.Both, fn: parseExtractedStyles },
  { kind: CompilationJobKind.Tmpl, fn: removeEmptyBindings },
  { kind: CompilationJobKind.Both, fn: collapseSingletonInterpolations },
  { kind: CompilationJobKind.Both, fn: orderOps },
  { kind: CompilationJobKind.Tmpl, fn: generateConditionalExpressions },
  { kind: CompilationJobKind.Tmpl, fn: createPipes },
  { kind: CompilationJobKind.Tmpl, fn: configureDeferInstructions },
  { kind: CompilationJobKind.Tmpl, fn: convertI18nText },
  { kind: CompilationJobKind.Tmpl, fn: convertI18nBindings },
  { kind: CompilationJobKind.Tmpl, fn: removeUnusedI18nAttributesOps },
  { kind: CompilationJobKind.Tmpl, fn: assignI18nSlotDependencies },
  { kind: CompilationJobKind.Tmpl, fn: applyI18nExpressions },
  { kind: CompilationJobKind.Tmpl, fn: createVariadicPipes },
  { kind: CompilationJobKind.Both, fn: generatePureLiteralStructures },
  { kind: CompilationJobKind.Tmpl, fn: generateProjectionDefs },
  { kind: CompilationJobKind.Tmpl, fn: generateLocalLetReferences },
  { kind: CompilationJobKind.Tmpl, fn: generateVariables },
  { kind: CompilationJobKind.Tmpl, fn: saveAndRestoreView },
  { kind: CompilationJobKind.Both, fn: deleteAnyCasts },
  { kind: CompilationJobKind.Both, fn: resolveDollarEvent },
  { kind: CompilationJobKind.Tmpl, fn: generateTrackVariables },
  { kind: CompilationJobKind.Tmpl, fn: removeIllegalLetReferences },
  { kind: CompilationJobKind.Both, fn: resolveNames },
  { kind: CompilationJobKind.Tmpl, fn: resolveDeferTargetNames },
  { kind: CompilationJobKind.Tmpl, fn: transformTwoWayBindingSet },
  { kind: CompilationJobKind.Tmpl, fn: optimizeTrackFns },
  { kind: CompilationJobKind.Both, fn: resolveContexts },
  { kind: CompilationJobKind.Both, fn: resolveSanitizers },
  { kind: CompilationJobKind.Tmpl, fn: liftLocalRefs },
  { kind: CompilationJobKind.Both, fn: generateNullishCoalesceExpressions },
  { kind: CompilationJobKind.Both, fn: expandSafeReads },
  { kind: CompilationJobKind.Both, fn: generateTemporaryVariables },
  { kind: CompilationJobKind.Both, fn: optimizeVariables },
  { kind: CompilationJobKind.Both, fn: optimizeStoreLet },
  { kind: CompilationJobKind.Tmpl, fn: allocateSlots },
  { kind: CompilationJobKind.Tmpl, fn: resolveI18nElementPlaceholders },
  { kind: CompilationJobKind.Tmpl, fn: resolveI18nExpressionPlaceholders },
  { kind: CompilationJobKind.Tmpl, fn: extractI18nMessages },
  { kind: CompilationJobKind.Tmpl, fn: generateTrackFns },
  { kind: CompilationJobKind.Tmpl, fn: collectI18nConsts },
  { kind: CompilationJobKind.Tmpl, fn: collectConstExpressions },
  { kind: CompilationJobKind.Both, fn: collectElementConsts },
  { kind: CompilationJobKind.Tmpl, fn: removeI18nContexts },
  { kind: CompilationJobKind.Both, fn: countVariables },
  { kind: CompilationJobKind.Tmpl, fn: generateAdvance },
  { kind: CompilationJobKind.Both, fn: nameFunctionsAndVariables },
  { kind: CompilationJobKind.Tmpl, fn: resolveDeferDepsFns },
  { kind: CompilationJobKind.Tmpl, fn: mergeNextContextExpressions },
  { kind: CompilationJobKind.Tmpl, fn: generateNgContainerOps },
  { kind: CompilationJobKind.Tmpl, fn: collapseEmptyInstructions },
  { kind: CompilationJobKind.Tmpl, fn: disableBindings$1 },
  { kind: CompilationJobKind.Both, fn: extractPureFunctions },
  { kind: CompilationJobKind.Both, fn: reify },
  { kind: CompilationJobKind.Both, fn: chain }
];
function transform(job, kind) {
  for (const phase of phases) {
    if (phase.kind === kind || phase.kind === CompilationJobKind.Both) {
      phase.fn(job);
    }
  }
}
function emitTemplateFn(tpl, pool) {
  const rootFn = emitView(tpl.root);
  emitChildViews(tpl.root, pool);
  return rootFn;
}
function emitChildViews(parent, pool) {
  for (const unit of parent.job.units) {
    if (unit.parent !== parent.xref) {
      continue;
    }
    emitChildViews(unit, pool);
    const viewFn = emitView(unit);
    pool.statements.push(viewFn.toDeclStmt(viewFn.name));
  }
}
function emitView(view) {
  if (view.fnName === null) {
    throw new Error(`AssertionError: view ${view.xref} is unnamed`);
  }
  const createStatements = [];
  for (const op of view.create) {
    if (op.kind !== OpKind.Statement) {
      throw new Error(`AssertionError: expected all create ops to have been compiled, but got ${OpKind[op.kind]}`);
    }
    createStatements.push(op.statement);
  }
  const updateStatements = [];
  for (const op of view.update) {
    if (op.kind !== OpKind.Statement) {
      throw new Error(`AssertionError: expected all update ops to have been compiled, but got ${OpKind[op.kind]}`);
    }
    updateStatements.push(op.statement);
  }
  const createCond = maybeGenerateRfBlock(1, createStatements);
  const updateCond = maybeGenerateRfBlock(2, updateStatements);
  return fn(
    [new FnParam("rf"), new FnParam("ctx")],
    [...createCond, ...updateCond],
    /* type */
    void 0,
    /* sourceSpan */
    void 0,
    view.fnName
  );
}
function maybeGenerateRfBlock(flag, statements) {
  if (statements.length === 0) {
    return [];
  }
  return [
    ifStmt(new BinaryOperatorExpr(BinaryOperator.BitwiseAnd, variable("rf"), literal(flag)), statements)
  ];
}
function emitHostBindingFunction(job) {
  if (job.root.fnName === null) {
    throw new Error(`AssertionError: host binding function is unnamed`);
  }
  const createStatements = [];
  for (const op of job.root.create) {
    if (op.kind !== OpKind.Statement) {
      throw new Error(`AssertionError: expected all create ops to have been compiled, but got ${OpKind[op.kind]}`);
    }
    createStatements.push(op.statement);
  }
  const updateStatements = [];
  for (const op of job.root.update) {
    if (op.kind !== OpKind.Statement) {
      throw new Error(`AssertionError: expected all update ops to have been compiled, but got ${OpKind[op.kind]}`);
    }
    updateStatements.push(op.statement);
  }
  if (createStatements.length === 0 && updateStatements.length === 0) {
    return null;
  }
  const createCond = maybeGenerateRfBlock(1, createStatements);
  const updateCond = maybeGenerateRfBlock(2, updateStatements);
  return fn(
    [new FnParam("rf"), new FnParam("ctx")],
    [...createCond, ...updateCond],
    /* type */
    void 0,
    /* sourceSpan */
    void 0,
    job.root.fnName
  );
}
const compatibilityMode = CompatibilityMode.TemplateDefinitionBuilder;
const domSchema = new DomElementSchemaRegistry();
const NG_TEMPLATE_TAG_NAME = "ng-template";
function isI18nRootNode(meta) {
  return meta instanceof Message;
}
function isSingleI18nIcu(meta) {
  return isI18nRootNode(meta) && meta.nodes.length === 1 && meta.nodes[0] instanceof Icu;
}
function ingestComponent(componentName, template2, constantPool, relativeContextFilePath, i18nUseExternalIds, deferMeta, allDeferrableDepsFn) {
  const job = new ComponentCompilationJob(componentName, constantPool, compatibilityMode, relativeContextFilePath, i18nUseExternalIds, deferMeta, allDeferrableDepsFn);
  ingestNodes(job.root, template2);
  return job;
}
function ingestHostBinding(input, bindingParser, constantPool) {
  const job = new HostBindingCompilationJob(input.componentName, constantPool, compatibilityMode);
  for (const property2 of input.properties ?? []) {
    let bindingKind = BindingKind.Property;
    if (property2.name.startsWith("attr.")) {
      property2.name = property2.name.substring("attr.".length);
      bindingKind = BindingKind.Attribute;
    }
    if (property2.isAnimation) {
      bindingKind = BindingKind.Animation;
    }
    const securityContexts = bindingParser.calcPossibleSecurityContexts(input.componentSelector, property2.name, bindingKind === BindingKind.Attribute).filter((context) => context !== SecurityContext.NONE);
    ingestHostProperty(job, property2, bindingKind, securityContexts);
  }
  for (const [name, expr] of Object.entries(input.attributes) ?? []) {
    const securityContexts = bindingParser.calcPossibleSecurityContexts(input.componentSelector, name, true).filter((context) => context !== SecurityContext.NONE);
    ingestHostAttribute(job, name, expr, securityContexts);
  }
  for (const event of input.events ?? []) {
    ingestHostEvent(job, event);
  }
  return job;
}
function ingestHostProperty(job, property2, bindingKind, securityContexts) {
  let expression;
  const ast = property2.expression.ast;
  if (ast instanceof Interpolation$1) {
    expression = new Interpolation(ast.strings, ast.expressions.map((expr) => convertAst(expr, job, property2.sourceSpan)), []);
  } else {
    expression = convertAst(ast, job, property2.sourceSpan);
  }
  job.root.update.push(createBindingOp(
    job.root.xref,
    bindingKind,
    property2.name,
    expression,
    null,
    securityContexts,
    false,
    false,
    null,
    /* TODO: How do Host bindings handle i18n attrs? */
    null,
    property2.sourceSpan
  ));
}
function ingestHostAttribute(job, name, value, securityContexts) {
  const attrBinding = createBindingOp(
    job.root.xref,
    BindingKind.Attribute,
    name,
    value,
    null,
    securityContexts,
    /* Host attributes should always be extracted to const hostAttrs, even if they are not
     *strictly* text literals */
    true,
    false,
    null,
    /* TODO */
    null,
    /** TODO: May be null? */
    value.sourceSpan
  );
  job.root.update.push(attrBinding);
}
function ingestHostEvent(job, event) {
  const [phase, target] = event.type !== ParsedEventType.Animation ? [null, event.targetOrPhase] : [event.targetOrPhase, null];
  const eventBinding = createListenerOp(job.root.xref, new SlotHandle(), event.name, null, makeListenerHandlerOps(job.root, event.handler, event.handlerSpan), phase, target, true, event.sourceSpan);
  job.root.create.push(eventBinding);
}
function ingestNodes(unit, template2) {
  for (const node of template2) {
    if (node instanceof Element$1) {
      ingestElement(unit, node);
    } else if (node instanceof Template) {
      ingestTemplate(unit, node);
    } else if (node instanceof Content) {
      ingestContent(unit, node);
    } else if (node instanceof Text$3) {
      ingestText(unit, node, null);
    } else if (node instanceof BoundText) {
      ingestBoundText(unit, node, null);
    } else if (node instanceof IfBlock) {
      ingestIfBlock(unit, node);
    } else if (node instanceof SwitchBlock) {
      ingestSwitchBlock(unit, node);
    } else if (node instanceof DeferredBlock) {
      ingestDeferBlock(unit, node);
    } else if (node instanceof Icu$1) {
      ingestIcu(unit, node);
    } else if (node instanceof ForLoopBlock) {
      ingestForBlock(unit, node);
    } else if (node instanceof LetDeclaration$1) {
      ingestLetDeclaration(unit, node);
    } else {
      throw new Error(`Unsupported template node: ${node.constructor.name}`);
    }
  }
}
function ingestElement(unit, element2) {
  if (element2.i18n !== void 0 && !(element2.i18n instanceof Message || element2.i18n instanceof TagPlaceholder)) {
    throw Error(`Unhandled i18n metadata type for element: ${element2.i18n.constructor.name}`);
  }
  const id = unit.job.allocateXrefId();
  const [namespaceKey, elementName] = splitNsName(element2.name);
  const startOp = createElementStartOp(elementName, id, namespaceForKey(namespaceKey), element2.i18n instanceof TagPlaceholder ? element2.i18n : void 0, element2.startSourceSpan, element2.sourceSpan);
  unit.create.push(startOp);
  ingestElementBindings(unit, startOp, element2);
  ingestReferences(startOp, element2);
  let i18nBlockId = null;
  if (element2.i18n instanceof Message) {
    i18nBlockId = unit.job.allocateXrefId();
    unit.create.push(createI18nStartOp(i18nBlockId, element2.i18n, void 0, element2.startSourceSpan));
  }
  ingestNodes(unit, element2.children);
  const endOp = createElementEndOp(id, element2.endSourceSpan ?? element2.startSourceSpan);
  unit.create.push(endOp);
  if (i18nBlockId !== null) {
    OpList.insertBefore(createI18nEndOp(i18nBlockId, element2.endSourceSpan ?? element2.startSourceSpan), endOp);
  }
}
function ingestTemplate(unit, tmpl) {
  if (tmpl.i18n !== void 0 && !(tmpl.i18n instanceof Message || tmpl.i18n instanceof TagPlaceholder)) {
    throw Error(`Unhandled i18n metadata type for template: ${tmpl.i18n.constructor.name}`);
  }
  const childView = unit.job.allocateView(unit.xref);
  let tagNameWithoutNamespace = tmpl.tagName;
  let namespacePrefix = "";
  if (tmpl.tagName) {
    [namespacePrefix, tagNameWithoutNamespace] = splitNsName(tmpl.tagName);
  }
  const i18nPlaceholder = tmpl.i18n instanceof TagPlaceholder ? tmpl.i18n : void 0;
  const namespace = namespaceForKey(namespacePrefix);
  const functionNameSuffix = tagNameWithoutNamespace === null ? "" : prefixWithNamespace(tagNameWithoutNamespace, namespace);
  const templateKind = isPlainTemplate(tmpl) ? TemplateKind.NgTemplate : TemplateKind.Structural;
  const templateOp = createTemplateOp(childView.xref, templateKind, tagNameWithoutNamespace, functionNameSuffix, namespace, i18nPlaceholder, tmpl.startSourceSpan, tmpl.sourceSpan);
  unit.create.push(templateOp);
  ingestTemplateBindings(unit, templateOp, tmpl, templateKind);
  ingestReferences(templateOp, tmpl);
  ingestNodes(childView, tmpl.children);
  for (const { name, value } of tmpl.variables) {
    childView.contextVariables.set(name, value !== "" ? value : "$implicit");
  }
  if (templateKind === TemplateKind.NgTemplate && tmpl.i18n instanceof Message) {
    const id = unit.job.allocateXrefId();
    OpList.insertAfter(createI18nStartOp(id, tmpl.i18n, void 0, tmpl.startSourceSpan), childView.create.head);
    OpList.insertBefore(createI18nEndOp(id, tmpl.endSourceSpan ?? tmpl.startSourceSpan), childView.create.tail);
  }
}
function ingestContent(unit, content) {
  if (content.i18n !== void 0 && !(content.i18n instanceof TagPlaceholder)) {
    throw Error(`Unhandled i18n metadata type for element: ${content.i18n.constructor.name}`);
  }
  let fallbackView = null;
  if (content.children.some((child) => !(child instanceof Comment$1) && (!(child instanceof Text$3) || child.value.trim().length > 0))) {
    fallbackView = unit.job.allocateView(unit.xref);
    ingestNodes(fallbackView, content.children);
  }
  const id = unit.job.allocateXrefId();
  const op = createProjectionOp(id, content.selector, content.i18n, fallbackView?.xref ?? null, content.sourceSpan);
  for (const attr of content.attributes) {
    const securityContext = domSchema.securityContext(content.name, attr.name, true);
    unit.update.push(createBindingOp(op.xref, BindingKind.Attribute, attr.name, literal(attr.value), null, securityContext, true, false, null, asMessage(attr.i18n), attr.sourceSpan));
  }
  unit.create.push(op);
}
function ingestText(unit, text2, icuPlaceholder) {
  unit.create.push(createTextOp(unit.job.allocateXrefId(), text2.value, icuPlaceholder, text2.sourceSpan));
}
function ingestBoundText(unit, text2, icuPlaceholder) {
  let value = text2.value;
  if (value instanceof ASTWithSource) {
    value = value.ast;
  }
  if (!(value instanceof Interpolation$1)) {
    throw new Error(`AssertionError: expected Interpolation for BoundText node, got ${value.constructor.name}`);
  }
  if (text2.i18n !== void 0 && !(text2.i18n instanceof Container)) {
    throw Error(`Unhandled i18n metadata type for text interpolation: ${text2.i18n?.constructor.name}`);
  }
  const i18nPlaceholders = text2.i18n instanceof Container ? text2.i18n.children.filter((node) => node instanceof Placeholder).map((placeholder) => placeholder.name) : [];
  if (i18nPlaceholders.length > 0 && i18nPlaceholders.length !== value.expressions.length) {
    throw Error(`Unexpected number of i18n placeholders (${value.expressions.length}) for BoundText with ${value.expressions.length} expressions`);
  }
  const textXref = unit.job.allocateXrefId();
  unit.create.push(createTextOp(textXref, "", icuPlaceholder, text2.sourceSpan));
  const baseSourceSpan = unit.job.compatibility ? null : text2.sourceSpan;
  unit.update.push(createInterpolateTextOp(textXref, new Interpolation(value.strings, value.expressions.map((expr) => convertAst(expr, unit.job, baseSourceSpan)), i18nPlaceholders), text2.sourceSpan));
}
function ingestIfBlock(unit, ifBlock) {
  let firstXref = null;
  let conditions = [];
  for (let i = 0; i < ifBlock.branches.length; i++) {
    const ifCase = ifBlock.branches[i];
    const cView = unit.job.allocateView(unit.xref);
    const tagName = ingestControlFlowInsertionPoint(unit, cView.xref, ifCase);
    if (ifCase.expressionAlias !== null) {
      cView.contextVariables.set(ifCase.expressionAlias.name, CTX_REF);
    }
    let ifCaseI18nMeta = void 0;
    if (ifCase.i18n !== void 0) {
      if (!(ifCase.i18n instanceof BlockPlaceholder)) {
        throw Error(`Unhandled i18n metadata type for if block: ${ifCase.i18n?.constructor.name}`);
      }
      ifCaseI18nMeta = ifCase.i18n;
    }
    const templateOp = createTemplateOp(cView.xref, TemplateKind.Block, tagName, "Conditional", Namespace.HTML, ifCaseI18nMeta, ifCase.startSourceSpan, ifCase.sourceSpan);
    unit.create.push(templateOp);
    if (firstXref === null) {
      firstXref = cView.xref;
    }
    const caseExpr = ifCase.expression ? convertAst(ifCase.expression, unit.job, null) : null;
    const conditionalCaseExpr = new ConditionalCaseExpr(caseExpr, templateOp.xref, templateOp.handle, ifCase.expressionAlias);
    conditions.push(conditionalCaseExpr);
    ingestNodes(cView, ifCase.children);
  }
  unit.update.push(createConditionalOp(firstXref, null, conditions, ifBlock.sourceSpan));
}
function ingestSwitchBlock(unit, switchBlock) {
  if (switchBlock.cases.length === 0) {
    return;
  }
  let firstXref = null;
  let conditions = [];
  for (const switchCase of switchBlock.cases) {
    const cView = unit.job.allocateView(unit.xref);
    const tagName = ingestControlFlowInsertionPoint(unit, cView.xref, switchCase);
    let switchCaseI18nMeta = void 0;
    if (switchCase.i18n !== void 0) {
      if (!(switchCase.i18n instanceof BlockPlaceholder)) {
        throw Error(`Unhandled i18n metadata type for switch block: ${switchCase.i18n?.constructor.name}`);
      }
      switchCaseI18nMeta = switchCase.i18n;
    }
    const templateOp = createTemplateOp(cView.xref, TemplateKind.Block, tagName, "Case", Namespace.HTML, switchCaseI18nMeta, switchCase.startSourceSpan, switchCase.sourceSpan);
    unit.create.push(templateOp);
    if (firstXref === null) {
      firstXref = cView.xref;
    }
    const caseExpr = switchCase.expression ? convertAst(switchCase.expression, unit.job, switchBlock.startSourceSpan) : null;
    const conditionalCaseExpr = new ConditionalCaseExpr(caseExpr, templateOp.xref, templateOp.handle);
    conditions.push(conditionalCaseExpr);
    ingestNodes(cView, switchCase.children);
  }
  unit.update.push(createConditionalOp(firstXref, convertAst(switchBlock.expression, unit.job, null), conditions, switchBlock.sourceSpan));
}
function ingestDeferView(unit, suffix, i18nMeta, children, sourceSpan) {
  if (i18nMeta !== void 0 && !(i18nMeta instanceof BlockPlaceholder)) {
    throw Error("Unhandled i18n metadata type for defer block");
  }
  if (children === void 0) {
    return null;
  }
  const secondaryView = unit.job.allocateView(unit.xref);
  ingestNodes(secondaryView, children);
  const templateOp = createTemplateOp(secondaryView.xref, TemplateKind.Block, null, `Defer${suffix}`, Namespace.HTML, i18nMeta, sourceSpan, sourceSpan);
  unit.create.push(templateOp);
  return templateOp;
}
function ingestDeferBlock(unit, deferBlock) {
  let ownResolverFn = null;
  if (unit.job.deferMeta.mode === 0) {
    if (!unit.job.deferMeta.blocks.has(deferBlock)) {
      throw new Error(`AssertionError: unable to find a dependency function for this deferred block`);
    }
    ownResolverFn = unit.job.deferMeta.blocks.get(deferBlock) ?? null;
  }
  const main = ingestDeferView(unit, "", deferBlock.i18n, deferBlock.children, deferBlock.sourceSpan);
  const loading = ingestDeferView(unit, "Loading", deferBlock.loading?.i18n, deferBlock.loading?.children, deferBlock.loading?.sourceSpan);
  const placeholder = ingestDeferView(unit, "Placeholder", deferBlock.placeholder?.i18n, deferBlock.placeholder?.children, deferBlock.placeholder?.sourceSpan);
  const error2 = ingestDeferView(unit, "Error", deferBlock.error?.i18n, deferBlock.error?.children, deferBlock.error?.sourceSpan);
  const deferXref = unit.job.allocateXrefId();
  const deferOp = createDeferOp(deferXref, main.xref, main.handle, ownResolverFn, unit.job.allDeferrableDepsFn, deferBlock.sourceSpan);
  deferOp.placeholderView = placeholder?.xref ?? null;
  deferOp.placeholderSlot = placeholder?.handle ?? null;
  deferOp.loadingSlot = loading?.handle ?? null;
  deferOp.errorSlot = error2?.handle ?? null;
  deferOp.placeholderMinimumTime = deferBlock.placeholder?.minimumTime ?? null;
  deferOp.loadingMinimumTime = deferBlock.loading?.minimumTime ?? null;
  deferOp.loadingAfterTime = deferBlock.loading?.afterTime ?? null;
  deferOp.flags = calcDeferBlockFlags(deferBlock);
  unit.create.push(deferOp);
  const deferOnOps = [];
  const deferWhenOps = [];
  ingestDeferTriggers("hydrate", deferBlock.hydrateTriggers, deferOnOps, deferWhenOps, unit, deferXref);
  ingestDeferTriggers("none", deferBlock.triggers, deferOnOps, deferWhenOps, unit, deferXref);
  ingestDeferTriggers("prefetch", deferBlock.prefetchTriggers, deferOnOps, deferWhenOps, unit, deferXref);
  const hasConcreteTrigger = deferOnOps.some(
    (op) => op.modifier === "none"
    /* ir.DeferOpModifierKind.NONE */
  ) || deferWhenOps.some(
    (op) => op.modifier === "none"
    /* ir.DeferOpModifierKind.NONE */
  );
  if (!hasConcreteTrigger) {
    deferOnOps.push(createDeferOnOp(deferXref, { kind: DeferTriggerKind.Idle }, "none", null));
  }
  unit.create.push(deferOnOps);
  unit.update.push(deferWhenOps);
}
function calcDeferBlockFlags(deferBlockDetails) {
  if (Object.keys(deferBlockDetails.hydrateTriggers).length > 0) {
    return 1;
  }
  return null;
}
function ingestDeferTriggers(modifier, triggers, onOps, whenOps, unit, deferXref) {
  if (triggers.idle !== void 0) {
    const deferOnOp = createDeferOnOp(deferXref, { kind: DeferTriggerKind.Idle }, modifier, triggers.idle.sourceSpan);
    onOps.push(deferOnOp);
  }
  if (triggers.immediate !== void 0) {
    const deferOnOp = createDeferOnOp(deferXref, { kind: DeferTriggerKind.Immediate }, modifier, triggers.immediate.sourceSpan);
    onOps.push(deferOnOp);
  }
  if (triggers.timer !== void 0) {
    const deferOnOp = createDeferOnOp(deferXref, { kind: DeferTriggerKind.Timer, delay: triggers.timer.delay }, modifier, triggers.timer.sourceSpan);
    onOps.push(deferOnOp);
  }
  if (triggers.hover !== void 0) {
    const deferOnOp = createDeferOnOp(deferXref, {
      kind: DeferTriggerKind.Hover,
      targetName: triggers.hover.reference,
      targetXref: null,
      targetSlot: null,
      targetView: null,
      targetSlotViewSteps: null
    }, modifier, triggers.hover.sourceSpan);
    onOps.push(deferOnOp);
  }
  if (triggers.interaction !== void 0) {
    const deferOnOp = createDeferOnOp(deferXref, {
      kind: DeferTriggerKind.Interaction,
      targetName: triggers.interaction.reference,
      targetXref: null,
      targetSlot: null,
      targetView: null,
      targetSlotViewSteps: null
    }, modifier, triggers.interaction.sourceSpan);
    onOps.push(deferOnOp);
  }
  if (triggers.viewport !== void 0) {
    const deferOnOp = createDeferOnOp(deferXref, {
      kind: DeferTriggerKind.Viewport,
      targetName: triggers.viewport.reference,
      targetXref: null,
      targetSlot: null,
      targetView: null,
      targetSlotViewSteps: null
    }, modifier, triggers.viewport.sourceSpan);
    onOps.push(deferOnOp);
  }
  if (triggers.never !== void 0) {
    const deferOnOp = createDeferOnOp(deferXref, { kind: DeferTriggerKind.Never }, modifier, triggers.never.sourceSpan);
    onOps.push(deferOnOp);
  }
  if (triggers.when !== void 0) {
    if (triggers.when.value instanceof Interpolation$1) {
      throw new Error(`Unexpected interpolation in defer block when trigger`);
    }
    const deferOnOp = createDeferWhenOp(deferXref, convertAst(triggers.when.value, unit.job, triggers.when.sourceSpan), modifier, triggers.when.sourceSpan);
    whenOps.push(deferOnOp);
  }
}
function ingestIcu(unit, icu) {
  if (icu.i18n instanceof Message && isSingleI18nIcu(icu.i18n)) {
    const xref = unit.job.allocateXrefId();
    unit.create.push(createIcuStartOp(xref, icu.i18n, icuFromI18nMessage(icu.i18n).name, null));
    for (const [placeholder, text2] of Object.entries({ ...icu.vars, ...icu.placeholders })) {
      if (text2 instanceof BoundText) {
        ingestBoundText(unit, text2, placeholder);
      } else {
        ingestText(unit, text2, placeholder);
      }
    }
    unit.create.push(createIcuEndOp(xref));
  } else {
    throw Error(`Unhandled i18n metadata type for ICU: ${icu.i18n?.constructor.name}`);
  }
}
function ingestForBlock(unit, forBlock) {
  const repeaterView = unit.job.allocateView(unit.xref);
  const indexName = `ɵ$index_${repeaterView.xref}`;
  const countName = `ɵ$count_${repeaterView.xref}`;
  const indexVarNames = /* @__PURE__ */ new Set();
  repeaterView.contextVariables.set(forBlock.item.name, forBlock.item.value);
  for (const variable2 of forBlock.contextVariables) {
    if (variable2.value === "$index") {
      indexVarNames.add(variable2.name);
    }
    if (variable2.name === "$index") {
      repeaterView.contextVariables.set("$index", variable2.value).set(indexName, variable2.value);
    } else if (variable2.name === "$count") {
      repeaterView.contextVariables.set("$count", variable2.value).set(countName, variable2.value);
    } else {
      repeaterView.aliases.add({
        kind: SemanticVariableKind.Alias,
        name: null,
        identifier: variable2.name,
        expression: getComputedForLoopVariableExpression(variable2, indexName, countName)
      });
    }
  }
  const sourceSpan = convertSourceSpan(forBlock.trackBy.span, forBlock.sourceSpan);
  const track = convertAst(forBlock.trackBy, unit.job, sourceSpan);
  ingestNodes(repeaterView, forBlock.children);
  let emptyView = null;
  let emptyTagName = null;
  if (forBlock.empty !== null) {
    emptyView = unit.job.allocateView(unit.xref);
    ingestNodes(emptyView, forBlock.empty.children);
    emptyTagName = ingestControlFlowInsertionPoint(unit, emptyView.xref, forBlock.empty);
  }
  const varNames = {
    $index: indexVarNames,
    $implicit: forBlock.item.name
  };
  if (forBlock.i18n !== void 0 && !(forBlock.i18n instanceof BlockPlaceholder)) {
    throw Error("AssertionError: Unhandled i18n metadata type or @for");
  }
  if (forBlock.empty?.i18n !== void 0 && !(forBlock.empty.i18n instanceof BlockPlaceholder)) {
    throw Error("AssertionError: Unhandled i18n metadata type or @empty");
  }
  const i18nPlaceholder = forBlock.i18n;
  const emptyI18nPlaceholder = forBlock.empty?.i18n;
  const tagName = ingestControlFlowInsertionPoint(unit, repeaterView.xref, forBlock);
  const repeaterCreate2 = createRepeaterCreateOp(repeaterView.xref, emptyView?.xref ?? null, tagName, track, varNames, emptyTagName, i18nPlaceholder, emptyI18nPlaceholder, forBlock.startSourceSpan, forBlock.sourceSpan);
  unit.create.push(repeaterCreate2);
  const expression = convertAst(forBlock.expression, unit.job, convertSourceSpan(forBlock.expression.span, forBlock.sourceSpan));
  const repeater2 = createRepeaterOp(repeaterCreate2.xref, repeaterCreate2.handle, expression, forBlock.sourceSpan);
  unit.update.push(repeater2);
}
function getComputedForLoopVariableExpression(variable2, indexName, countName) {
  switch (variable2.value) {
    case "$index":
      return new LexicalReadExpr(indexName);
    case "$count":
      return new LexicalReadExpr(countName);
    case "$first":
      return new LexicalReadExpr(indexName).identical(literal(0));
    case "$last":
      return new LexicalReadExpr(indexName).identical(new LexicalReadExpr(countName).minus(literal(1)));
    case "$even":
      return new LexicalReadExpr(indexName).modulo(literal(2)).identical(literal(0));
    case "$odd":
      return new LexicalReadExpr(indexName).modulo(literal(2)).notIdentical(literal(0));
    default:
      throw new Error(`AssertionError: unknown @for loop variable ${variable2.value}`);
  }
}
function ingestLetDeclaration(unit, node) {
  const target = unit.job.allocateXrefId();
  unit.create.push(createDeclareLetOp(target, node.name, node.sourceSpan));
  unit.update.push(createStoreLetOp(target, node.name, convertAst(node.value, unit.job, node.valueSpan), node.sourceSpan));
}
function convertAst(ast, job, baseSourceSpan) {
  if (ast instanceof ASTWithSource) {
    return convertAst(ast.ast, job, baseSourceSpan);
  } else if (ast instanceof PropertyRead) {
    const isImplicitReceiver = ast.receiver instanceof ImplicitReceiver && !(ast.receiver instanceof ThisReceiver);
    if (isImplicitReceiver) {
      return new LexicalReadExpr(ast.name);
    } else {
      return new ReadPropExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.name, null, convertSourceSpan(ast.span, baseSourceSpan));
    }
  } else if (ast instanceof PropertyWrite) {
    if (ast.receiver instanceof ImplicitReceiver) {
      return new WritePropExpr(
        // TODO: Is it correct to always use the root context in place of the implicit receiver?
        new ContextExpr(job.root.xref),
        ast.name,
        convertAst(ast.value, job, baseSourceSpan),
        null,
        convertSourceSpan(ast.span, baseSourceSpan)
      );
    }
    return new WritePropExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.name, convertAst(ast.value, job, baseSourceSpan), void 0, convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof KeyedWrite) {
    return new WriteKeyExpr(convertAst(ast.receiver, job, baseSourceSpan), convertAst(ast.key, job, baseSourceSpan), convertAst(ast.value, job, baseSourceSpan), void 0, convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof Call) {
    if (ast.receiver instanceof ImplicitReceiver) {
      throw new Error(`Unexpected ImplicitReceiver`);
    } else {
      return new InvokeFunctionExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.args.map((arg) => convertAst(arg, job, baseSourceSpan)), void 0, convertSourceSpan(ast.span, baseSourceSpan));
    }
  } else if (ast instanceof LiteralPrimitive) {
    return literal(ast.value, void 0, convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof Unary) {
    switch (ast.operator) {
      case "+":
        return new UnaryOperatorExpr(UnaryOperator.Plus, convertAst(ast.expr, job, baseSourceSpan), void 0, convertSourceSpan(ast.span, baseSourceSpan));
      case "-":
        return new UnaryOperatorExpr(UnaryOperator.Minus, convertAst(ast.expr, job, baseSourceSpan), void 0, convertSourceSpan(ast.span, baseSourceSpan));
      default:
        throw new Error(`AssertionError: unknown unary operator ${ast.operator}`);
    }
  } else if (ast instanceof Binary) {
    const operator = BINARY_OPERATORS.get(ast.operation);
    if (operator === void 0) {
      throw new Error(`AssertionError: unknown binary operator ${ast.operation}`);
    }
    return new BinaryOperatorExpr(operator, convertAst(ast.left, job, baseSourceSpan), convertAst(ast.right, job, baseSourceSpan), void 0, convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof ThisReceiver) {
    return new ContextExpr(job.root.xref);
  } else if (ast instanceof KeyedRead) {
    return new ReadKeyExpr(convertAst(ast.receiver, job, baseSourceSpan), convertAst(ast.key, job, baseSourceSpan), void 0, convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof Chain) {
    throw new Error(`AssertionError: Chain in unknown context`);
  } else if (ast instanceof LiteralMap) {
    const entries = ast.keys.map((key, idx) => {
      const value = ast.values[idx];
      return new LiteralMapEntry(key.key, convertAst(value, job, baseSourceSpan), key.quoted);
    });
    return new LiteralMapExpr(entries, void 0, convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof LiteralArray) {
    return new LiteralArrayExpr(ast.expressions.map((expr) => convertAst(expr, job, baseSourceSpan)));
  } else if (ast instanceof Conditional) {
    return new ConditionalExpr(convertAst(ast.condition, job, baseSourceSpan), convertAst(ast.trueExp, job, baseSourceSpan), convertAst(ast.falseExp, job, baseSourceSpan), void 0, convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof NonNullAssert) {
    return convertAst(ast.expression, job, baseSourceSpan);
  } else if (ast instanceof BindingPipe) {
    return new PipeBindingExpr(job.allocateXrefId(), new SlotHandle(), ast.name, [
      convertAst(ast.exp, job, baseSourceSpan),
      ...ast.args.map((arg) => convertAst(arg, job, baseSourceSpan))
    ]);
  } else if (ast instanceof SafeKeyedRead) {
    return new SafeKeyedReadExpr(convertAst(ast.receiver, job, baseSourceSpan), convertAst(ast.key, job, baseSourceSpan), convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof SafePropertyRead) {
    return new SafePropertyReadExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.name);
  } else if (ast instanceof SafeCall) {
    return new SafeInvokeFunctionExpr(convertAst(ast.receiver, job, baseSourceSpan), ast.args.map((a) => convertAst(a, job, baseSourceSpan)));
  } else if (ast instanceof EmptyExpr$1) {
    return new EmptyExpr(convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof PrefixNot) {
    return not(convertAst(ast.expression, job, baseSourceSpan), convertSourceSpan(ast.span, baseSourceSpan));
  } else if (ast instanceof TypeofExpression) {
    return typeofExpr(convertAst(ast.expression, job, baseSourceSpan));
  } else {
    throw new Error(`Unhandled expression type "${ast.constructor.name}" in file "${baseSourceSpan?.start.file.url}"`);
  }
}
function convertAstWithInterpolation(job, value, i18nMeta, sourceSpan) {
  let expression;
  if (value instanceof Interpolation$1) {
    expression = new Interpolation(value.strings, value.expressions.map((e) => convertAst(e, job, null)), Object.keys(asMessage(i18nMeta)?.placeholders ?? {}));
  } else if (value instanceof AST) {
    expression = convertAst(value, job, null);
  } else {
    expression = literal(value);
  }
  return expression;
}
const BINDING_KINDS = /* @__PURE__ */ new Map([
  [BindingType.Property, BindingKind.Property],
  [BindingType.TwoWay, BindingKind.TwoWayProperty],
  [BindingType.Attribute, BindingKind.Attribute],
  [BindingType.Class, BindingKind.ClassName],
  [BindingType.Style, BindingKind.StyleProperty],
  [BindingType.Animation, BindingKind.Animation]
]);
function isPlainTemplate(tmpl) {
  return splitNsName(tmpl.tagName ?? "")[1] === NG_TEMPLATE_TAG_NAME;
}
function asMessage(i18nMeta) {
  if (i18nMeta == null) {
    return null;
  }
  if (!(i18nMeta instanceof Message)) {
    throw Error(`Expected i18n meta to be a Message, but got: ${i18nMeta.constructor.name}`);
  }
  return i18nMeta;
}
function ingestElementBindings(unit, op, element2) {
  let bindings = new Array();
  let i18nAttributeBindingNames = /* @__PURE__ */ new Set();
  for (const attr of element2.attributes) {
    const securityContext = domSchema.securityContext(element2.name, attr.name, true);
    bindings.push(createBindingOp(op.xref, BindingKind.Attribute, attr.name, convertAstWithInterpolation(unit.job, attr.value, attr.i18n), null, securityContext, true, false, null, asMessage(attr.i18n), attr.sourceSpan));
    if (attr.i18n) {
      i18nAttributeBindingNames.add(attr.name);
    }
  }
  for (const input of element2.inputs) {
    if (i18nAttributeBindingNames.has(input.name)) {
      console.error(`On component ${unit.job.componentName}, the binding ${input.name} is both an i18n attribute and a property. You may want to remove the property binding. This will become a compilation error in future versions of Angular.`);
    }
    bindings.push(createBindingOp(op.xref, BINDING_KINDS.get(input.type), input.name, convertAstWithInterpolation(unit.job, astOf(input.value), input.i18n), input.unit, input.securityContext, false, false, null, asMessage(input.i18n) ?? null, input.sourceSpan));
  }
  unit.create.push(bindings.filter((b) => b?.kind === OpKind.ExtractedAttribute));
  unit.update.push(bindings.filter((b) => b?.kind === OpKind.Binding));
  for (const output of element2.outputs) {
    if (output.type === ParsedEventType.Animation && output.phase === null) {
      throw Error("Animation listener should have a phase");
    }
    if (output.type === ParsedEventType.TwoWay) {
      unit.create.push(createTwoWayListenerOp(op.xref, op.handle, output.name, op.tag, makeTwoWayListenerHandlerOps(unit, output.handler, output.handlerSpan), output.sourceSpan));
    } else {
      unit.create.push(createListenerOp(op.xref, op.handle, output.name, op.tag, makeListenerHandlerOps(unit, output.handler, output.handlerSpan), output.phase, output.target, false, output.sourceSpan));
    }
  }
  if (bindings.some((b) => b?.i18nMessage) !== null) {
    unit.create.push(createI18nAttributesOp(unit.job.allocateXrefId(), new SlotHandle(), op.xref));
  }
}
function ingestTemplateBindings(unit, op, template2, templateKind) {
  let bindings = new Array();
  for (const attr of template2.templateAttrs) {
    if (attr instanceof TextAttribute) {
      const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
      bindings.push(createTemplateBinding(unit, op.xref, BindingType.Attribute, attr.name, attr.value, null, securityContext, true, templateKind, asMessage(attr.i18n), attr.sourceSpan));
    } else {
      bindings.push(createTemplateBinding(unit, op.xref, attr.type, attr.name, astOf(attr.value), attr.unit, attr.securityContext, true, templateKind, asMessage(attr.i18n), attr.sourceSpan));
    }
  }
  for (const attr of template2.attributes) {
    const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
    bindings.push(createTemplateBinding(unit, op.xref, BindingType.Attribute, attr.name, attr.value, null, securityContext, false, templateKind, asMessage(attr.i18n), attr.sourceSpan));
  }
  for (const input of template2.inputs) {
    bindings.push(createTemplateBinding(unit, op.xref, input.type, input.name, astOf(input.value), input.unit, input.securityContext, false, templateKind, asMessage(input.i18n), input.sourceSpan));
  }
  unit.create.push(bindings.filter((b) => b?.kind === OpKind.ExtractedAttribute));
  unit.update.push(bindings.filter((b) => b?.kind === OpKind.Binding));
  for (const output of template2.outputs) {
    if (output.type === ParsedEventType.Animation && output.phase === null) {
      throw Error("Animation listener should have a phase");
    }
    if (templateKind === TemplateKind.NgTemplate) {
      if (output.type === ParsedEventType.TwoWay) {
        unit.create.push(createTwoWayListenerOp(op.xref, op.handle, output.name, op.tag, makeTwoWayListenerHandlerOps(unit, output.handler, output.handlerSpan), output.sourceSpan));
      } else {
        unit.create.push(createListenerOp(op.xref, op.handle, output.name, op.tag, makeListenerHandlerOps(unit, output.handler, output.handlerSpan), output.phase, output.target, false, output.sourceSpan));
      }
    }
    if (templateKind === TemplateKind.Structural && output.type !== ParsedEventType.Animation) {
      const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, output.name, false);
      unit.create.push(createExtractedAttributeOp(op.xref, BindingKind.Property, null, output.name, null, null, null, securityContext));
    }
  }
  if (bindings.some((b) => b?.i18nMessage) !== null) {
    unit.create.push(createI18nAttributesOp(unit.job.allocateXrefId(), new SlotHandle(), op.xref));
  }
}
function createTemplateBinding(view, xref, type, name, value, unit, securityContext, isStructuralTemplateAttribute, templateKind, i18nMessage, sourceSpan) {
  const isTextBinding = typeof value === "string";
  if (templateKind === TemplateKind.Structural) {
    if (!isStructuralTemplateAttribute) {
      switch (type) {
        case BindingType.Property:
        case BindingType.Class:
        case BindingType.Style:
          return createExtractedAttributeOp(xref, BindingKind.Property, null, name, null, null, i18nMessage, securityContext);
        case BindingType.TwoWay:
          return createExtractedAttributeOp(xref, BindingKind.TwoWayProperty, null, name, null, null, i18nMessage, securityContext);
      }
    }
    if (!isTextBinding && (type === BindingType.Attribute || type === BindingType.Animation)) {
      return null;
    }
  }
  let bindingType = BINDING_KINDS.get(type);
  if (templateKind === TemplateKind.NgTemplate) {
    if (type === BindingType.Class || type === BindingType.Style || type === BindingType.Attribute && !isTextBinding) {
      bindingType = BindingKind.Property;
    }
  }
  return createBindingOp(xref, bindingType, name, convertAstWithInterpolation(view.job, value, i18nMessage), unit, securityContext, isTextBinding, isStructuralTemplateAttribute, templateKind, i18nMessage, sourceSpan);
}
function makeListenerHandlerOps(unit, handler, handlerSpan) {
  handler = astOf(handler);
  const handlerOps = new Array();
  let handlerExprs = handler instanceof Chain ? handler.expressions : [handler];
  if (handlerExprs.length === 0) {
    throw new Error("Expected listener to have non-empty expression list.");
  }
  const expressions = handlerExprs.map((expr) => convertAst(expr, unit.job, handlerSpan));
  const returnExpr = expressions.pop();
  handlerOps.push(...expressions.map((e) => createStatementOp(new ExpressionStatement(e, e.sourceSpan))));
  handlerOps.push(createStatementOp(new ReturnStatement(returnExpr, returnExpr.sourceSpan)));
  return handlerOps;
}
function makeTwoWayListenerHandlerOps(unit, handler, handlerSpan) {
  handler = astOf(handler);
  const handlerOps = new Array();
  if (handler instanceof Chain) {
    if (handler.expressions.length === 1) {
      handler = handler.expressions[0];
    } else {
      throw new Error("Expected two-way listener to have a single expression.");
    }
  }
  const handlerExpr = convertAst(handler, unit.job, handlerSpan);
  const eventReference = new LexicalReadExpr("$event");
  const twoWaySetExpr = new TwoWayBindingSetExpr(handlerExpr, eventReference);
  handlerOps.push(createStatementOp(new ExpressionStatement(twoWaySetExpr)));
  handlerOps.push(createStatementOp(new ReturnStatement(eventReference)));
  return handlerOps;
}
function astOf(ast) {
  return ast instanceof ASTWithSource ? ast.ast : ast;
}
function ingestReferences(op, element2) {
  assertIsArray(op.localRefs);
  for (const { name, value } of element2.references) {
    op.localRefs.push({
      name,
      target: value
    });
  }
}
function assertIsArray(value) {
  if (!Array.isArray(value)) {
    throw new Error(`AssertionError: expected an array`);
  }
}
function convertSourceSpan(span, baseSourceSpan) {
  if (baseSourceSpan === null) {
    return null;
  }
  const start = baseSourceSpan.start.moveBy(span.start);
  const end = baseSourceSpan.start.moveBy(span.end);
  const fullStart = baseSourceSpan.fullStart.moveBy(span.start);
  return new ParseSourceSpan(start, end, fullStart);
}
function ingestControlFlowInsertionPoint(unit, xref, node) {
  let root = null;
  for (const child of node.children) {
    if (child instanceof Comment$1 || child instanceof LetDeclaration$1) {
      continue;
    }
    if (root !== null) {
      return null;
    }
    if (child instanceof Element$1 || child instanceof Template && child.tagName !== null) {
      root = child;
    } else {
      return null;
    }
  }
  if (root !== null) {
    for (const attr of root.attributes) {
      const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
      unit.update.push(createBindingOp(xref, BindingKind.Attribute, attr.name, literal(attr.value), null, securityContext, true, false, null, asMessage(attr.i18n), attr.sourceSpan));
    }
    for (const attr of root.inputs) {
      if (attr.type !== BindingType.Animation && attr.type !== BindingType.Attribute) {
        const securityContext = domSchema.securityContext(NG_TEMPLATE_TAG_NAME, attr.name, true);
        unit.create.push(createExtractedAttributeOp(xref, BindingKind.Property, null, attr.name, null, null, null, securityContext));
      }
    }
    const tagName = root instanceof Element$1 ? root.name : root.tagName;
    return tagName === NG_TEMPLATE_TAG_NAME ? null : tagName;
  }
  return null;
}
function renderFlagCheckIfStmt(flags, statements) {
  return ifStmt(variable(RENDER_FLAGS).bitwiseAnd(literal(flags), null, false), statements);
}
function toQueryFlags(query) {
  return (query.descendants ? 1 : 0) | (query.static ? 2 : 0) | (query.emitDistinctChangesOnly ? 4 : 0);
}
function getQueryPredicate(query, constantPool) {
  if (Array.isArray(query.predicate)) {
    let predicate = [];
    query.predicate.forEach((selector) => {
      const selectors = selector.split(",").map((token) => literal(token.trim()));
      predicate.push(...selectors);
    });
    return constantPool.getConstLiteral(literalArr(predicate), true);
  } else {
    switch (query.predicate.forwardRef) {
      case 0:
      case 2:
        return query.predicate.expression;
      case 1:
        return importExpr(Identifiers.resolveForwardRef).callFn([query.predicate.expression]);
    }
  }
}
function createQueryCreateCall(query, constantPool, queryTypeFns, prependParams) {
  const parameters = [];
  if (prependParams !== void 0) {
    parameters.push(...prependParams);
  }
  if (query.isSignal) {
    parameters.push(new ReadPropExpr(variable(CONTEXT_NAME), query.propertyName));
  }
  parameters.push(getQueryPredicate(query, constantPool), literal(toQueryFlags(query)));
  if (query.read) {
    parameters.push(query.read);
  }
  const queryCreateFn = query.isSignal ? queryTypeFns.signalBased : queryTypeFns.nonSignal;
  return importExpr(queryCreateFn).callFn(parameters);
}
const queryAdvancePlaceholder = Symbol("queryAdvancePlaceholder");
function collapseAdvanceStatements(statements) {
  const result = [];
  let advanceCollapseCount = 0;
  const flushAdvanceCount = () => {
    if (advanceCollapseCount > 0) {
      result.unshift(importExpr(Identifiers.queryAdvance).callFn(advanceCollapseCount === 1 ? [] : [literal(advanceCollapseCount)]).toStmt());
      advanceCollapseCount = 0;
    }
  };
  for (let i = statements.length - 1; i >= 0; i--) {
    const st = statements[i];
    if (st === queryAdvancePlaceholder) {
      advanceCollapseCount++;
    } else {
      flushAdvanceCount();
      result.unshift(st);
    }
  }
  flushAdvanceCount();
  return result;
}
function createViewQueriesFunction(viewQueries, constantPool, name) {
  const createStatements = [];
  const updateStatements = [];
  const tempAllocator = temporaryAllocator((st) => updateStatements.push(st), TEMPORARY_NAME);
  viewQueries.forEach((query) => {
    const queryDefinitionCall = createQueryCreateCall(query, constantPool, {
      signalBased: Identifiers.viewQuerySignal,
      nonSignal: Identifiers.viewQuery
    });
    createStatements.push(queryDefinitionCall.toStmt());
    if (query.isSignal) {
      updateStatements.push(queryAdvancePlaceholder);
      return;
    }
    const temporary = tempAllocator();
    const getQueryList = importExpr(Identifiers.loadQuery).callFn([]);
    const refresh = importExpr(Identifiers.queryRefresh).callFn([temporary.set(getQueryList)]);
    const updateDirective = variable(CONTEXT_NAME).prop(query.propertyName).set(query.first ? temporary.prop("first") : temporary);
    updateStatements.push(refresh.and(updateDirective).toStmt());
  });
  const viewQueryFnName = name ? `${name}_Query` : null;
  return fn([new FnParam(RENDER_FLAGS, NUMBER_TYPE), new FnParam(CONTEXT_NAME, null)], [
    renderFlagCheckIfStmt(1, createStatements),
    renderFlagCheckIfStmt(2, collapseAdvanceStatements(updateStatements))
  ], INFERRED_TYPE, null, viewQueryFnName);
}
function createContentQueriesFunction(queries, constantPool, name) {
  const createStatements = [];
  const updateStatements = [];
  const tempAllocator = temporaryAllocator((st) => updateStatements.push(st), TEMPORARY_NAME);
  for (const query of queries) {
    createStatements.push(createQueryCreateCall(
      query,
      constantPool,
      { nonSignal: Identifiers.contentQuery, signalBased: Identifiers.contentQuerySignal },
      /* prependParams */
      [variable("dirIndex")]
    ).toStmt());
    if (query.isSignal) {
      updateStatements.push(queryAdvancePlaceholder);
      continue;
    }
    const temporary = tempAllocator();
    const getQueryList = importExpr(Identifiers.loadQuery).callFn([]);
    const refresh = importExpr(Identifiers.queryRefresh).callFn([temporary.set(getQueryList)]);
    const updateDirective = variable(CONTEXT_NAME).prop(query.propertyName).set(query.first ? temporary.prop("first") : temporary);
    updateStatements.push(refresh.and(updateDirective).toStmt());
  }
  const contentQueriesFnName = name ? `${name}_ContentQueries` : null;
  return fn([
    new FnParam(RENDER_FLAGS, NUMBER_TYPE),
    new FnParam(CONTEXT_NAME, null),
    new FnParam("dirIndex", null)
  ], [
    renderFlagCheckIfStmt(1, createStatements),
    renderFlagCheckIfStmt(2, collapseAdvanceStatements(updateStatements))
  ], INFERRED_TYPE, null, contentQueriesFnName);
}
class HtmlParser extends Parser$1 {
  constructor() {
    super(getHtmlTagDefinition);
  }
  parse(source, url, options) {
    return super.parse(source, url, options);
  }
}
const PROPERTY_PARTS_SEPARATOR = ".";
const ATTRIBUTE_PREFIX = "attr";
const CLASS_PREFIX = "class";
const STYLE_PREFIX = "style";
const TEMPLATE_ATTR_PREFIX$1 = "*";
const ANIMATE_PROP_PREFIX = "animate-";
class BindingParser {
  _exprParser;
  _interpolationConfig;
  _schemaRegistry;
  errors;
  constructor(_exprParser, _interpolationConfig, _schemaRegistry, errors) {
    this._exprParser = _exprParser;
    this._interpolationConfig = _interpolationConfig;
    this._schemaRegistry = _schemaRegistry;
    this.errors = errors;
  }
  get interpolationConfig() {
    return this._interpolationConfig;
  }
  createBoundHostProperties(properties, sourceSpan) {
    const boundProps = [];
    for (const propName of Object.keys(properties)) {
      const expression = properties[propName];
      if (typeof expression === "string") {
        this.parsePropertyBinding(
          propName,
          expression,
          true,
          false,
          sourceSpan,
          sourceSpan.start.offset,
          void 0,
          [],
          // Use the `sourceSpan` for  `keySpan`. This isn't really accurate, but neither is the
          // sourceSpan, as it represents the sourceSpan of the host itself rather than the
          // source of the host binding (which doesn't exist in the template). Regardless,
          // neither of these values are used in Ivy but are only here to satisfy the function
          // signature. This should likely be refactored in the future so that `sourceSpan`
          // isn't being used inaccurately.
          boundProps,
          sourceSpan
        );
      } else {
        this._reportError(`Value of the host property binding "${propName}" needs to be a string representing an expression but got "${expression}" (${typeof expression})`, sourceSpan);
      }
    }
    return boundProps;
  }
  createDirectiveHostEventAsts(hostListeners, sourceSpan) {
    const targetEvents = [];
    for (const propName of Object.keys(hostListeners)) {
      const expression = hostListeners[propName];
      if (typeof expression === "string") {
        this.parseEvent(
          propName,
          expression,
          /* isAssignmentEvent */
          false,
          sourceSpan,
          sourceSpan,
          [],
          targetEvents,
          sourceSpan
        );
      } else {
        this._reportError(`Value of the host listener "${propName}" needs to be a string representing an expression but got "${expression}" (${typeof expression})`, sourceSpan);
      }
    }
    return targetEvents;
  }
  parseInterpolation(value, sourceSpan, interpolatedTokens) {
    const sourceInfo = sourceSpan.start.toString();
    const absoluteOffset = sourceSpan.fullStart.offset;
    try {
      const ast = this._exprParser.parseInterpolation(value, sourceInfo, absoluteOffset, interpolatedTokens, this._interpolationConfig);
      if (ast)
        this._reportExpressionParserErrors(ast.errors, sourceSpan);
      return ast;
    } catch (e) {
      this._reportError(`${e}`, sourceSpan);
      return this._exprParser.wrapLiteralPrimitive("ERROR", sourceInfo, absoluteOffset);
    }
  }
  /**
   * Similar to `parseInterpolation`, but treats the provided string as a single expression
   * element that would normally appear within the interpolation prefix and suffix (`{{` and `}}`).
   * This is used for parsing the switch expression in ICUs.
   */
  parseInterpolationExpression(expression, sourceSpan) {
    const sourceInfo = sourceSpan.start.toString();
    const absoluteOffset = sourceSpan.start.offset;
    try {
      const ast = this._exprParser.parseInterpolationExpression(expression, sourceInfo, absoluteOffset);
      if (ast)
        this._reportExpressionParserErrors(ast.errors, sourceSpan);
      return ast;
    } catch (e) {
      this._reportError(`${e}`, sourceSpan);
      return this._exprParser.wrapLiteralPrimitive("ERROR", sourceInfo, absoluteOffset);
    }
  }
  /**
   * Parses the bindings in a microsyntax expression, and converts them to
   * `ParsedProperty` or `ParsedVariable`.
   *
   * @param tplKey template binding name
   * @param tplValue template binding value
   * @param sourceSpan span of template binding relative to entire the template
   * @param absoluteValueOffset start of the tplValue relative to the entire template
   * @param targetMatchableAttrs potential attributes to match in the template
   * @param targetProps target property bindings in the template
   * @param targetVars target variables in the template
   */
  parseInlineTemplateBinding(tplKey, tplValue, sourceSpan, absoluteValueOffset, targetMatchableAttrs, targetProps, targetVars, isIvyAst) {
    const absoluteKeyOffset = sourceSpan.start.offset + TEMPLATE_ATTR_PREFIX$1.length;
    const bindings = this._parseTemplateBindings(tplKey, tplValue, sourceSpan, absoluteKeyOffset, absoluteValueOffset);
    for (const binding of bindings) {
      const bindingSpan = moveParseSourceSpan(sourceSpan, binding.sourceSpan);
      const key = binding.key.source;
      const keySpan = moveParseSourceSpan(sourceSpan, binding.key.span);
      if (binding instanceof VariableBinding) {
        const value = binding.value ? binding.value.source : "$implicit";
        const valueSpan = binding.value ? moveParseSourceSpan(sourceSpan, binding.value.span) : void 0;
        targetVars.push(new ParsedVariable(key, value, bindingSpan, keySpan, valueSpan));
      } else if (binding.value) {
        const srcSpan = isIvyAst ? bindingSpan : sourceSpan;
        const valueSpan = moveParseSourceSpan(sourceSpan, binding.value.ast.sourceSpan);
        this._parsePropertyAst(key, binding.value, false, srcSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps);
      } else {
        targetMatchableAttrs.push([
          key,
          ""
          /* value */
        ]);
        this.parseLiteralAttr(key, null, keySpan, absoluteValueOffset, void 0, targetMatchableAttrs, targetProps, keySpan);
      }
    }
  }
  /**
   * Parses the bindings in a microsyntax expression, e.g.
   * ```
   *    <tag *tplKey="let value1 = prop; let value2 = localVar">
   * ```
   *
   * @param tplKey template binding name
   * @param tplValue template binding value
   * @param sourceSpan span of template binding relative to entire the template
   * @param absoluteKeyOffset start of the `tplKey`
   * @param absoluteValueOffset start of the `tplValue`
   */
  _parseTemplateBindings(tplKey, tplValue, sourceSpan, absoluteKeyOffset, absoluteValueOffset) {
    const sourceInfo = sourceSpan.start.toString();
    try {
      const bindingsResult = this._exprParser.parseTemplateBindings(tplKey, tplValue, sourceInfo, absoluteKeyOffset, absoluteValueOffset);
      this._reportExpressionParserErrors(bindingsResult.errors, sourceSpan);
      bindingsResult.warnings.forEach((warning) => {
        this._reportError(warning, sourceSpan, ParseErrorLevel.WARNING);
      });
      return bindingsResult.templateBindings;
    } catch (e) {
      this._reportError(`${e}`, sourceSpan);
      return [];
    }
  }
  parseLiteralAttr(name, value, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps, keySpan) {
    if (isAnimationLabel(name)) {
      name = name.substring(1);
      if (keySpan !== void 0) {
        keySpan = moveParseSourceSpan(keySpan, new AbsoluteSourceSpan(keySpan.start.offset + 1, keySpan.end.offset));
      }
      if (value) {
        this._reportError(`Assigning animation triggers via @prop="exp" attributes with an expression is invalid. Use property bindings (e.g. [@prop]="exp") or use an attribute without a value (e.g. @prop) instead.`, sourceSpan, ParseErrorLevel.ERROR);
      }
      this._parseAnimation(name, value, sourceSpan, absoluteOffset, keySpan, valueSpan, targetMatchableAttrs, targetProps);
    } else {
      targetProps.push(new ParsedProperty(name, this._exprParser.wrapLiteralPrimitive(value, "", absoluteOffset), ParsedPropertyType.LITERAL_ATTR, sourceSpan, keySpan, valueSpan));
    }
  }
  parsePropertyBinding(name, expression, isHost, isPartOfAssignmentBinding, sourceSpan, absoluteOffset, valueSpan, targetMatchableAttrs, targetProps, keySpan) {
    if (name.length === 0) {
      this._reportError(`Property name is missing in binding`, sourceSpan);
    }
    let isAnimationProp = false;
    if (name.startsWith(ANIMATE_PROP_PREFIX)) {
      isAnimationProp = true;
      name = name.substring(ANIMATE_PROP_PREFIX.length);
      if (keySpan !== void 0) {
        keySpan = moveParseSourceSpan(keySpan, new AbsoluteSourceSpan(keySpan.start.offset + ANIMATE_PROP_PREFIX.length, keySpan.end.offset));
      }
    } else if (isAnimationLabel(name)) {
      isAnimationProp = true;
      name = name.substring(1);
      if (keySpan !== void 0) {
        keySpan = moveParseSourceSpan(keySpan, new AbsoluteSourceSpan(keySpan.start.offset + 1, keySpan.end.offset));
      }
    }
    if (isAnimationProp) {
      this._parseAnimation(name, expression, sourceSpan, absoluteOffset, keySpan, valueSpan, targetMatchableAttrs, targetProps);
    } else {
      this._parsePropertyAst(name, this.parseBinding(expression, isHost, valueSpan || sourceSpan, absoluteOffset), isPartOfAssignmentBinding, sourceSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps);
    }
  }
  parsePropertyInterpolation(name, value, sourceSpan, valueSpan, targetMatchableAttrs, targetProps, keySpan, interpolatedTokens) {
    const expr = this.parseInterpolation(value, valueSpan || sourceSpan, interpolatedTokens);
    if (expr) {
      this._parsePropertyAst(name, expr, false, sourceSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps);
      return true;
    }
    return false;
  }
  _parsePropertyAst(name, ast, isPartOfAssignmentBinding, sourceSpan, keySpan, valueSpan, targetMatchableAttrs, targetProps) {
    targetMatchableAttrs.push([name, ast.source]);
    targetProps.push(new ParsedProperty(name, ast, isPartOfAssignmentBinding ? ParsedPropertyType.TWO_WAY : ParsedPropertyType.DEFAULT, sourceSpan, keySpan, valueSpan));
  }
  _parseAnimation(name, expression, sourceSpan, absoluteOffset, keySpan, valueSpan, targetMatchableAttrs, targetProps) {
    if (name.length === 0) {
      this._reportError("Animation trigger is missing", sourceSpan);
    }
    const ast = this.parseBinding(expression || "undefined", false, valueSpan || sourceSpan, absoluteOffset);
    targetMatchableAttrs.push([name, ast.source]);
    targetProps.push(new ParsedProperty(name, ast, ParsedPropertyType.ANIMATION, sourceSpan, keySpan, valueSpan));
  }
  parseBinding(value, isHostBinding2, sourceSpan, absoluteOffset) {
    const sourceInfo = (sourceSpan && sourceSpan.start || "(unknown)").toString();
    try {
      const ast = isHostBinding2 ? this._exprParser.parseSimpleBinding(value, sourceInfo, absoluteOffset, this._interpolationConfig) : this._exprParser.parseBinding(value, sourceInfo, absoluteOffset, this._interpolationConfig);
      if (ast)
        this._reportExpressionParserErrors(ast.errors, sourceSpan);
      return ast;
    } catch (e) {
      this._reportError(`${e}`, sourceSpan);
      return this._exprParser.wrapLiteralPrimitive("ERROR", sourceInfo, absoluteOffset);
    }
  }
  createBoundElementProperty(elementSelector, boundProp, skipValidation = false, mapPropertyName = true) {
    if (boundProp.isAnimation) {
      return new BoundElementProperty(boundProp.name, BindingType.Animation, SecurityContext.NONE, boundProp.expression, null, boundProp.sourceSpan, boundProp.keySpan, boundProp.valueSpan);
    }
    let unit = null;
    let bindingType = void 0;
    let boundPropertyName = null;
    const parts = boundProp.name.split(PROPERTY_PARTS_SEPARATOR);
    let securityContexts = void 0;
    if (parts.length > 1) {
      if (parts[0] == ATTRIBUTE_PREFIX) {
        boundPropertyName = parts.slice(1).join(PROPERTY_PARTS_SEPARATOR);
        if (!skipValidation) {
          this._validatePropertyOrAttributeName(boundPropertyName, boundProp.sourceSpan, true);
        }
        securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, boundPropertyName, true);
        const nsSeparatorIdx = boundPropertyName.indexOf(":");
        if (nsSeparatorIdx > -1) {
          const ns = boundPropertyName.substring(0, nsSeparatorIdx);
          const name = boundPropertyName.substring(nsSeparatorIdx + 1);
          boundPropertyName = mergeNsAndName(ns, name);
        }
        bindingType = BindingType.Attribute;
      } else if (parts[0] == CLASS_PREFIX) {
        boundPropertyName = parts[1];
        bindingType = BindingType.Class;
        securityContexts = [SecurityContext.NONE];
      } else if (parts[0] == STYLE_PREFIX) {
        unit = parts.length > 2 ? parts[2] : null;
        boundPropertyName = parts[1];
        bindingType = BindingType.Style;
        securityContexts = [SecurityContext.STYLE];
      }
    }
    if (boundPropertyName === null) {
      const mappedPropName = this._schemaRegistry.getMappedPropName(boundProp.name);
      boundPropertyName = mapPropertyName ? mappedPropName : boundProp.name;
      securityContexts = calcPossibleSecurityContexts(this._schemaRegistry, elementSelector, mappedPropName, false);
      bindingType = boundProp.type === ParsedPropertyType.TWO_WAY ? BindingType.TwoWay : BindingType.Property;
      if (!skipValidation) {
        this._validatePropertyOrAttributeName(mappedPropName, boundProp.sourceSpan, false);
      }
    }
    return new BoundElementProperty(boundPropertyName, bindingType, securityContexts[0], boundProp.expression, unit, boundProp.sourceSpan, boundProp.keySpan, boundProp.valueSpan);
  }
  // TODO: keySpan should be required but was made optional to avoid changing VE parser.
  parseEvent(name, expression, isAssignmentEvent, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents, keySpan) {
    if (name.length === 0) {
      this._reportError(`Event name is missing in binding`, sourceSpan);
    }
    if (isAnimationLabel(name)) {
      name = name.slice(1);
      if (keySpan !== void 0) {
        keySpan = moveParseSourceSpan(keySpan, new AbsoluteSourceSpan(keySpan.start.offset + 1, keySpan.end.offset));
      }
      this._parseAnimationEvent(name, expression, sourceSpan, handlerSpan, targetEvents, keySpan);
    } else {
      this._parseRegularEvent(name, expression, isAssignmentEvent, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents, keySpan);
    }
  }
  calcPossibleSecurityContexts(selector, propName, isAttribute) {
    const prop = this._schemaRegistry.getMappedPropName(propName);
    return calcPossibleSecurityContexts(this._schemaRegistry, selector, prop, isAttribute);
  }
  _parseAnimationEvent(name, expression, sourceSpan, handlerSpan, targetEvents, keySpan) {
    const matches = splitAtPeriod(name, [name, ""]);
    const eventName = matches[0];
    const phase = matches[1].toLowerCase();
    const ast = this._parseAction(expression, handlerSpan);
    targetEvents.push(new ParsedEvent(eventName, phase, ParsedEventType.Animation, ast, sourceSpan, handlerSpan, keySpan));
    if (eventName.length === 0) {
      this._reportError(`Animation event name is missing in binding`, sourceSpan);
    }
    if (phase) {
      if (phase !== "start" && phase !== "done") {
        this._reportError(`The provided animation output phase value "${phase}" for "@${eventName}" is not supported (use start or done)`, sourceSpan);
      }
    } else {
      this._reportError(`The animation trigger output event (@${eventName}) is missing its phase value name (start or done are currently supported)`, sourceSpan);
    }
  }
  _parseRegularEvent(name, expression, isAssignmentEvent, sourceSpan, handlerSpan, targetMatchableAttrs, targetEvents, keySpan) {
    const [target, eventName] = splitAtColon(name, [null, name]);
    const prevErrorCount = this.errors.length;
    const ast = this._parseAction(expression, handlerSpan);
    const isValid = this.errors.length === prevErrorCount;
    targetMatchableAttrs.push([name, ast.source]);
    if (isAssignmentEvent && isValid && !this._isAllowedAssignmentEvent(ast)) {
      this._reportError("Unsupported expression in a two-way binding", sourceSpan);
    }
    targetEvents.push(new ParsedEvent(eventName, target, isAssignmentEvent ? ParsedEventType.TwoWay : ParsedEventType.Regular, ast, sourceSpan, handlerSpan, keySpan));
  }
  _parseAction(value, sourceSpan) {
    const sourceInfo = (sourceSpan && sourceSpan.start || "(unknown").toString();
    const absoluteOffset = sourceSpan && sourceSpan.start ? sourceSpan.start.offset : 0;
    try {
      const ast = this._exprParser.parseAction(value, sourceInfo, absoluteOffset, this._interpolationConfig);
      if (ast) {
        this._reportExpressionParserErrors(ast.errors, sourceSpan);
      }
      if (!ast || ast.ast instanceof EmptyExpr$1) {
        this._reportError(`Empty expressions are not allowed`, sourceSpan);
        return this._exprParser.wrapLiteralPrimitive("ERROR", sourceInfo, absoluteOffset);
      }
      return ast;
    } catch (e) {
      this._reportError(`${e}`, sourceSpan);
      return this._exprParser.wrapLiteralPrimitive("ERROR", sourceInfo, absoluteOffset);
    }
  }
  _reportError(message, sourceSpan, level = ParseErrorLevel.ERROR, relatedError) {
    this.errors.push(new ParseError(sourceSpan, message, level, relatedError));
  }
  _reportExpressionParserErrors(errors, sourceSpan) {
    for (const error2 of errors) {
      this._reportError(error2.message, sourceSpan, void 0, error2);
    }
  }
  /**
   * @param propName the name of the property / attribute
   * @param sourceSpan
   * @param isAttr true when binding to an attribute
   */
  _validatePropertyOrAttributeName(propName, sourceSpan, isAttr) {
    const report = isAttr ? this._schemaRegistry.validateAttribute(propName) : this._schemaRegistry.validateProperty(propName);
    if (report.error) {
      this._reportError(report.msg, sourceSpan, ParseErrorLevel.ERROR);
    }
  }
  /**
   * Returns whether a parsed AST is allowed to be used within the event side of a two-way binding.
   * @param ast Parsed AST to be checked.
   */
  _isAllowedAssignmentEvent(ast) {
    if (ast instanceof ASTWithSource) {
      return this._isAllowedAssignmentEvent(ast.ast);
    }
    if (ast instanceof NonNullAssert) {
      return this._isAllowedAssignmentEvent(ast.expression);
    }
    if (ast instanceof PropertyRead || ast instanceof KeyedRead) {
      return true;
    }
    return false;
  }
}
function isAnimationLabel(name) {
  return name[0] == "@";
}
function calcPossibleSecurityContexts(registry, selector, propName, isAttribute) {
  const ctxs = [];
  CssSelector.parse(selector).forEach((selector2) => {
    const elementNames = selector2.element ? [selector2.element] : registry.allKnownElementNames();
    const notElementNames = new Set(selector2.notSelectors.filter((selector3) => selector3.isElementSelector()).map((selector3) => selector3.element));
    const possibleElementNames = elementNames.filter((elementName) => !notElementNames.has(elementName));
    ctxs.push(...possibleElementNames.map((elementName) => registry.securityContext(elementName, propName, isAttribute)));
  });
  return ctxs.length === 0 ? [SecurityContext.NONE] : Array.from(new Set(ctxs)).sort();
}
function moveParseSourceSpan(sourceSpan, absoluteSpan) {
  const startDiff = absoluteSpan.start - sourceSpan.start.offset;
  const endDiff = absoluteSpan.end - sourceSpan.end.offset;
  return new ParseSourceSpan(sourceSpan.start.moveBy(startDiff), sourceSpan.end.moveBy(endDiff), sourceSpan.fullStart.moveBy(startDiff), sourceSpan.details);
}
function isStyleUrlResolvable(url) {
  if (url == null || url.length === 0 || url[0] == "/")
    return false;
  const schemeMatch = url.match(URL_WITH_SCHEMA_REGEXP);
  return schemeMatch === null || schemeMatch[1] == "package" || schemeMatch[1] == "asset";
}
const URL_WITH_SCHEMA_REGEXP = /^([^:/?#]+):/;
const NG_CONTENT_SELECT_ATTR = "select";
const LINK_ELEMENT = "link";
const LINK_STYLE_REL_ATTR = "rel";
const LINK_STYLE_HREF_ATTR = "href";
const LINK_STYLE_REL_VALUE = "stylesheet";
const STYLE_ELEMENT = "style";
const SCRIPT_ELEMENT = "script";
const NG_NON_BINDABLE_ATTR = "ngNonBindable";
const NG_PROJECT_AS = "ngProjectAs";
function preparseElement(ast) {
  let selectAttr = null;
  let hrefAttr = null;
  let relAttr = null;
  let nonBindable = false;
  let projectAs = "";
  ast.attrs.forEach((attr) => {
    const lcAttrName = attr.name.toLowerCase();
    if (lcAttrName == NG_CONTENT_SELECT_ATTR) {
      selectAttr = attr.value;
    } else if (lcAttrName == LINK_STYLE_HREF_ATTR) {
      hrefAttr = attr.value;
    } else if (lcAttrName == LINK_STYLE_REL_ATTR) {
      relAttr = attr.value;
    } else if (attr.name == NG_NON_BINDABLE_ATTR) {
      nonBindable = true;
    } else if (attr.name == NG_PROJECT_AS) {
      if (attr.value.length > 0) {
        projectAs = attr.value;
      }
    }
  });
  selectAttr = normalizeNgContentSelect(selectAttr);
  const nodeName = ast.name.toLowerCase();
  let type = PreparsedElementType.OTHER;
  if (isNgContent(nodeName)) {
    type = PreparsedElementType.NG_CONTENT;
  } else if (nodeName == STYLE_ELEMENT) {
    type = PreparsedElementType.STYLE;
  } else if (nodeName == SCRIPT_ELEMENT) {
    type = PreparsedElementType.SCRIPT;
  } else if (nodeName == LINK_ELEMENT && relAttr == LINK_STYLE_REL_VALUE) {
    type = PreparsedElementType.STYLESHEET;
  }
  return new PreparsedElement(type, selectAttr, hrefAttr, nonBindable, projectAs);
}
var PreparsedElementType;
(function(PreparsedElementType2) {
  PreparsedElementType2[PreparsedElementType2["NG_CONTENT"] = 0] = "NG_CONTENT";
  PreparsedElementType2[PreparsedElementType2["STYLE"] = 1] = "STYLE";
  PreparsedElementType2[PreparsedElementType2["STYLESHEET"] = 2] = "STYLESHEET";
  PreparsedElementType2[PreparsedElementType2["SCRIPT"] = 3] = "SCRIPT";
  PreparsedElementType2[PreparsedElementType2["OTHER"] = 4] = "OTHER";
})(PreparsedElementType || (PreparsedElementType = {}));
class PreparsedElement {
  type;
  selectAttr;
  hrefAttr;
  nonBindable;
  projectAs;
  constructor(type, selectAttr, hrefAttr, nonBindable, projectAs) {
    this.type = type;
    this.selectAttr = selectAttr;
    this.hrefAttr = hrefAttr;
    this.nonBindable = nonBindable;
    this.projectAs = projectAs;
  }
}
function normalizeNgContentSelect(selectAttr) {
  if (selectAttr === null || selectAttr.length === 0) {
    return "*";
  }
  return selectAttr;
}
const FOR_LOOP_EXPRESSION_PATTERN = /^\s*([0-9A-Za-z_$]*)\s+of\s+([\S\s]*)/;
const FOR_LOOP_TRACK_PATTERN = /^track\s+([\S\s]*)/;
const CONDITIONAL_ALIAS_PATTERN = /^(as\s)+(.*)/;
const ELSE_IF_PATTERN = /^else[^\S\r\n]+if/;
const FOR_LOOP_LET_PATTERN = /^let\s+([\S\s]*)/;
const CHARACTERS_IN_SURROUNDING_WHITESPACE_PATTERN = /(\s*)(\S+)(\s*)/;
const ALLOWED_FOR_LOOP_LET_VARIABLES = /* @__PURE__ */ new Set([
  "$index",
  "$first",
  "$last",
  "$even",
  "$odd",
  "$count"
]);
function isConnectedForLoopBlock(name) {
  return name === "empty";
}
function isConnectedIfLoopBlock(name) {
  return name === "else" || ELSE_IF_PATTERN.test(name);
}
function createIfBlock(ast, connectedBlocks, visitor, bindingParser) {
  const errors = validateIfConnectedBlocks(connectedBlocks);
  const branches = [];
  const mainBlockParams = parseConditionalBlockParameters(ast, errors, bindingParser);
  if (mainBlockParams !== null) {
    branches.push(new IfBlockBranch(mainBlockParams.expression, visitAll(visitor, ast.children, ast.children), mainBlockParams.expressionAlias, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.nameSpan, ast.i18n));
  }
  for (const block of connectedBlocks) {
    if (ELSE_IF_PATTERN.test(block.name)) {
      const params = parseConditionalBlockParameters(block, errors, bindingParser);
      if (params !== null) {
        const children = visitAll(visitor, block.children, block.children);
        branches.push(new IfBlockBranch(params.expression, children, params.expressionAlias, block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan, block.i18n));
      }
    } else if (block.name === "else") {
      const children = visitAll(visitor, block.children, block.children);
      branches.push(new IfBlockBranch(null, children, null, block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan, block.i18n));
    }
  }
  const ifBlockStartSourceSpan = branches.length > 0 ? branches[0].startSourceSpan : ast.startSourceSpan;
  const ifBlockEndSourceSpan = branches.length > 0 ? branches[branches.length - 1].endSourceSpan : ast.endSourceSpan;
  let wholeSourceSpan = ast.sourceSpan;
  const lastBranch = branches[branches.length - 1];
  if (lastBranch !== void 0) {
    wholeSourceSpan = new ParseSourceSpan(ifBlockStartSourceSpan.start, lastBranch.sourceSpan.end);
  }
  return {
    node: new IfBlock(branches, wholeSourceSpan, ast.startSourceSpan, ifBlockEndSourceSpan, ast.nameSpan),
    errors
  };
}
function createForLoop(ast, connectedBlocks, visitor, bindingParser) {
  const errors = [];
  const params = parseForLoopParameters(ast, errors, bindingParser);
  let node = null;
  let empty = null;
  for (const block of connectedBlocks) {
    if (block.name === "empty") {
      if (empty !== null) {
        errors.push(new ParseError(block.sourceSpan, "@for loop can only have one @empty block"));
      } else if (block.parameters.length > 0) {
        errors.push(new ParseError(block.sourceSpan, "@empty block cannot have parameters"));
      } else {
        empty = new ForLoopBlockEmpty(visitAll(visitor, block.children, block.children), block.sourceSpan, block.startSourceSpan, block.endSourceSpan, block.nameSpan, block.i18n);
      }
    } else {
      errors.push(new ParseError(block.sourceSpan, `Unrecognized @for loop block "${block.name}"`));
    }
  }
  if (params !== null) {
    if (params.trackBy === null) {
      errors.push(new ParseError(ast.startSourceSpan, '@for loop must have a "track" expression'));
    } else {
      const endSpan = empty?.endSourceSpan ?? ast.endSourceSpan;
      const sourceSpan = new ParseSourceSpan(ast.sourceSpan.start, endSpan?.end ?? ast.sourceSpan.end);
      node = new ForLoopBlock(params.itemName, params.expression, params.trackBy.expression, params.trackBy.keywordSpan, params.context, visitAll(visitor, ast.children, ast.children), empty, sourceSpan, ast.sourceSpan, ast.startSourceSpan, endSpan, ast.nameSpan, ast.i18n);
    }
  }
  return { node, errors };
}
function createSwitchBlock(ast, visitor, bindingParser) {
  const errors = validateSwitchBlock(ast);
  const primaryExpression = ast.parameters.length > 0 ? parseBlockParameterToBinding(ast.parameters[0], bindingParser) : bindingParser.parseBinding("", false, ast.sourceSpan, 0);
  const cases = [];
  const unknownBlocks = [];
  let defaultCase = null;
  for (const node of ast.children) {
    if (!(node instanceof Block)) {
      continue;
    }
    if ((node.name !== "case" || node.parameters.length === 0) && node.name !== "default") {
      unknownBlocks.push(new UnknownBlock(node.name, node.sourceSpan, node.nameSpan));
      continue;
    }
    const expression = node.name === "case" ? parseBlockParameterToBinding(node.parameters[0], bindingParser) : null;
    const ast2 = new SwitchBlockCase(expression, visitAll(visitor, node.children, node.children), node.sourceSpan, node.startSourceSpan, node.endSourceSpan, node.nameSpan, node.i18n);
    if (expression === null) {
      defaultCase = ast2;
    } else {
      cases.push(ast2);
    }
  }
  if (defaultCase !== null) {
    cases.push(defaultCase);
  }
  return {
    node: new SwitchBlock(primaryExpression, cases, unknownBlocks, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.nameSpan),
    errors
  };
}
function parseForLoopParameters(block, errors, bindingParser) {
  if (block.parameters.length === 0) {
    errors.push(new ParseError(block.startSourceSpan, "@for loop does not have an expression"));
    return null;
  }
  const [expressionParam, ...secondaryParams] = block.parameters;
  const match = stripOptionalParentheses(expressionParam, errors)?.match(FOR_LOOP_EXPRESSION_PATTERN);
  if (!match || match[2].trim().length === 0) {
    errors.push(new ParseError(expressionParam.sourceSpan, 'Cannot parse expression. @for loop expression must match the pattern "<identifier> of <expression>"'));
    return null;
  }
  const [, itemName, rawExpression] = match;
  if (ALLOWED_FOR_LOOP_LET_VARIABLES.has(itemName)) {
    errors.push(new ParseError(expressionParam.sourceSpan, `@for loop item name cannot be one of ${Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES).join(", ")}.`));
  }
  const variableName = expressionParam.expression.split(" ")[0];
  const variableSpan = new ParseSourceSpan(expressionParam.sourceSpan.start, expressionParam.sourceSpan.start.moveBy(variableName.length));
  const result = {
    itemName: new Variable(itemName, "$implicit", variableSpan, variableSpan),
    trackBy: null,
    expression: parseBlockParameterToBinding(expressionParam, bindingParser, rawExpression),
    context: Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES, (variableName2) => {
      const emptySpanAfterForBlockStart = new ParseSourceSpan(block.startSourceSpan.end, block.startSourceSpan.end);
      return new Variable(variableName2, variableName2, emptySpanAfterForBlockStart, emptySpanAfterForBlockStart);
    })
  };
  for (const param of secondaryParams) {
    const letMatch = param.expression.match(FOR_LOOP_LET_PATTERN);
    if (letMatch !== null) {
      const variablesSpan = new ParseSourceSpan(param.sourceSpan.start.moveBy(letMatch[0].length - letMatch[1].length), param.sourceSpan.end);
      parseLetParameter(param.sourceSpan, letMatch[1], variablesSpan, itemName, result.context, errors);
      continue;
    }
    const trackMatch = param.expression.match(FOR_LOOP_TRACK_PATTERN);
    if (trackMatch !== null) {
      if (result.trackBy !== null) {
        errors.push(new ParseError(param.sourceSpan, '@for loop can only have one "track" expression'));
      } else {
        const expression = parseBlockParameterToBinding(param, bindingParser, trackMatch[1]);
        if (expression.ast instanceof EmptyExpr$1) {
          errors.push(new ParseError(block.startSourceSpan, '@for loop must have a "track" expression'));
        }
        const keywordSpan = new ParseSourceSpan(param.sourceSpan.start, param.sourceSpan.start.moveBy("track".length));
        result.trackBy = { expression, keywordSpan };
      }
      continue;
    }
    errors.push(new ParseError(param.sourceSpan, `Unrecognized @for loop paramater "${param.expression}"`));
  }
  return result;
}
function parseLetParameter(sourceSpan, expression, span, loopItemName, context, errors) {
  const parts = expression.split(",");
  let startSpan = span.start;
  for (const part of parts) {
    const expressionParts = part.split("=");
    const name = expressionParts.length === 2 ? expressionParts[0].trim() : "";
    const variableName = expressionParts.length === 2 ? expressionParts[1].trim() : "";
    if (name.length === 0 || variableName.length === 0) {
      errors.push(new ParseError(sourceSpan, `Invalid @for loop "let" parameter. Parameter should match the pattern "<name> = <variable name>"`));
    } else if (!ALLOWED_FOR_LOOP_LET_VARIABLES.has(variableName)) {
      errors.push(new ParseError(sourceSpan, `Unknown "let" parameter variable "${variableName}". The allowed variables are: ${Array.from(ALLOWED_FOR_LOOP_LET_VARIABLES).join(", ")}`));
    } else if (name === loopItemName) {
      errors.push(new ParseError(sourceSpan, `Invalid @for loop "let" parameter. Variable cannot be called "${loopItemName}"`));
    } else if (context.some((v) => v.name === name)) {
      errors.push(new ParseError(sourceSpan, `Duplicate "let" parameter variable "${variableName}"`));
    } else {
      const [, keyLeadingWhitespace, keyName] = expressionParts[0].match(CHARACTERS_IN_SURROUNDING_WHITESPACE_PATTERN) ?? [];
      const keySpan = keyLeadingWhitespace !== void 0 && expressionParts.length === 2 ? new ParseSourceSpan(
        /* strip leading spaces */
        startSpan.moveBy(keyLeadingWhitespace.length),
        /* advance to end of the variable name */
        startSpan.moveBy(keyLeadingWhitespace.length + keyName.length)
      ) : span;
      let valueSpan = void 0;
      if (expressionParts.length === 2) {
        const [, valueLeadingWhitespace, implicit] = expressionParts[1].match(CHARACTERS_IN_SURROUNDING_WHITESPACE_PATTERN) ?? [];
        valueSpan = valueLeadingWhitespace !== void 0 ? new ParseSourceSpan(startSpan.moveBy(expressionParts[0].length + 1 + valueLeadingWhitespace.length), startSpan.moveBy(expressionParts[0].length + 1 + valueLeadingWhitespace.length + implicit.length)) : void 0;
      }
      const sourceSpan2 = new ParseSourceSpan(keySpan.start, valueSpan?.end ?? keySpan.end);
      context.push(new Variable(name, variableName, sourceSpan2, keySpan, valueSpan));
    }
    startSpan = startSpan.moveBy(
      part.length + 1
      /* add 1 to move past the comma */
    );
  }
}
function validateIfConnectedBlocks(connectedBlocks) {
  const errors = [];
  let hasElse = false;
  for (let i = 0; i < connectedBlocks.length; i++) {
    const block = connectedBlocks[i];
    if (block.name === "else") {
      if (hasElse) {
        errors.push(new ParseError(block.startSourceSpan, "Conditional can only have one @else block"));
      } else if (connectedBlocks.length > 1 && i < connectedBlocks.length - 1) {
        errors.push(new ParseError(block.startSourceSpan, "@else block must be last inside the conditional"));
      } else if (block.parameters.length > 0) {
        errors.push(new ParseError(block.startSourceSpan, "@else block cannot have parameters"));
      }
      hasElse = true;
    } else if (!ELSE_IF_PATTERN.test(block.name)) {
      errors.push(new ParseError(block.startSourceSpan, `Unrecognized conditional block @${block.name}`));
    }
  }
  return errors;
}
function validateSwitchBlock(ast) {
  const errors = [];
  let hasDefault = false;
  if (ast.parameters.length !== 1) {
    errors.push(new ParseError(ast.startSourceSpan, "@switch block must have exactly one parameter"));
    return errors;
  }
  for (const node of ast.children) {
    if (node instanceof Comment || node instanceof Text && node.value.trim().length === 0) {
      continue;
    }
    if (!(node instanceof Block) || node.name !== "case" && node.name !== "default") {
      errors.push(new ParseError(node.sourceSpan, "@switch block can only contain @case and @default blocks"));
      continue;
    }
    if (node.name === "default") {
      if (hasDefault) {
        errors.push(new ParseError(node.startSourceSpan, "@switch block can only have one @default block"));
      } else if (node.parameters.length > 0) {
        errors.push(new ParseError(node.startSourceSpan, "@default block cannot have parameters"));
      }
      hasDefault = true;
    } else if (node.name === "case" && node.parameters.length !== 1) {
      errors.push(new ParseError(node.startSourceSpan, "@case block must have exactly one parameter"));
    }
  }
  return errors;
}
function parseBlockParameterToBinding(ast, bindingParser, part) {
  let start;
  let end;
  if (typeof part === "string") {
    start = Math.max(0, ast.expression.lastIndexOf(part));
    end = start + part.length;
  } else {
    start = 0;
    end = ast.expression.length;
  }
  return bindingParser.parseBinding(ast.expression.slice(start, end), false, ast.sourceSpan, ast.sourceSpan.start.offset + start);
}
function parseConditionalBlockParameters(block, errors, bindingParser) {
  if (block.parameters.length === 0) {
    errors.push(new ParseError(block.startSourceSpan, "Conditional block does not have an expression"));
    return null;
  }
  const expression = parseBlockParameterToBinding(block.parameters[0], bindingParser);
  let expressionAlias = null;
  for (let i = 1; i < block.parameters.length; i++) {
    const param = block.parameters[i];
    const aliasMatch = param.expression.match(CONDITIONAL_ALIAS_PATTERN);
    if (aliasMatch === null) {
      errors.push(new ParseError(param.sourceSpan, `Unrecognized conditional paramater "${param.expression}"`));
    } else if (block.name !== "if") {
      errors.push(new ParseError(param.sourceSpan, '"as" expression is only allowed on the primary @if block'));
    } else if (expressionAlias !== null) {
      errors.push(new ParseError(param.sourceSpan, 'Conditional can only have one "as" expression'));
    } else {
      const name = aliasMatch[2].trim();
      const variableStart = param.sourceSpan.start.moveBy(aliasMatch[1].length);
      const variableSpan = new ParseSourceSpan(variableStart, variableStart.moveBy(name.length));
      expressionAlias = new Variable(name, name, variableSpan, variableSpan);
    }
  }
  return { expression, expressionAlias };
}
function stripOptionalParentheses(param, errors) {
  const expression = param.expression;
  const spaceRegex = /^\s$/;
  let openParens = 0;
  let start = 0;
  let end = expression.length - 1;
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    if (char === "(") {
      start = i + 1;
      openParens++;
    } else if (spaceRegex.test(char)) {
      continue;
    } else {
      break;
    }
  }
  if (openParens === 0) {
    return expression;
  }
  for (let i = expression.length - 1; i > -1; i--) {
    const char = expression[i];
    if (char === ")") {
      end = i;
      openParens--;
      if (openParens === 0) {
        break;
      }
    } else if (spaceRegex.test(char)) {
      continue;
    } else {
      break;
    }
  }
  if (openParens !== 0) {
    errors.push(new ParseError(param.sourceSpan, "Unclosed parentheses in expression"));
    return null;
  }
  return expression.slice(start, end);
}
const TIME_PATTERN = /^\d+\.?\d*(ms|s)?$/;
const SEPARATOR_PATTERN = /^\s$/;
const COMMA_DELIMITED_SYNTAX = /* @__PURE__ */ new Map([
  [$LBRACE, $RBRACE],
  // Object literals
  [$LBRACKET, $RBRACKET],
  // Array literals
  [$LPAREN, $RPAREN]
  // Function calls
]);
var OnTriggerType;
(function(OnTriggerType2) {
  OnTriggerType2["IDLE"] = "idle";
  OnTriggerType2["TIMER"] = "timer";
  OnTriggerType2["INTERACTION"] = "interaction";
  OnTriggerType2["IMMEDIATE"] = "immediate";
  OnTriggerType2["HOVER"] = "hover";
  OnTriggerType2["VIEWPORT"] = "viewport";
  OnTriggerType2["NEVER"] = "never";
})(OnTriggerType || (OnTriggerType = {}));
function parseNeverTrigger({ expression, sourceSpan }, triggers, errors) {
  const neverIndex = expression.indexOf("never");
  const neverSourceSpan = new ParseSourceSpan(sourceSpan.start.moveBy(neverIndex), sourceSpan.start.moveBy(neverIndex + "never".length));
  const prefetchSpan = getPrefetchSpan(expression, sourceSpan);
  const hydrateSpan = getHydrateSpan(expression, sourceSpan);
  if (neverIndex === -1) {
    errors.push(new ParseError(sourceSpan, `Could not find "never" keyword in expression`));
  } else {
    trackTrigger("never", triggers, errors, new NeverDeferredTrigger(neverSourceSpan, sourceSpan, prefetchSpan, null, hydrateSpan));
  }
}
function parseWhenTrigger({ expression, sourceSpan }, bindingParser, triggers, errors) {
  const whenIndex = expression.indexOf("when");
  const whenSourceSpan = new ParseSourceSpan(sourceSpan.start.moveBy(whenIndex), sourceSpan.start.moveBy(whenIndex + "when".length));
  const prefetchSpan = getPrefetchSpan(expression, sourceSpan);
  const hydrateSpan = getHydrateSpan(expression, sourceSpan);
  if (whenIndex === -1) {
    errors.push(new ParseError(sourceSpan, `Could not find "when" keyword in expression`));
  } else {
    const start = getTriggerParametersStart(expression, whenIndex + 1);
    const parsed = bindingParser.parseBinding(expression.slice(start), false, sourceSpan, sourceSpan.start.offset + start);
    trackTrigger("when", triggers, errors, new BoundDeferredTrigger(parsed, sourceSpan, prefetchSpan, whenSourceSpan, hydrateSpan));
  }
}
function parseOnTrigger({ expression, sourceSpan }, triggers, errors, placeholder) {
  const onIndex = expression.indexOf("on");
  const onSourceSpan = new ParseSourceSpan(sourceSpan.start.moveBy(onIndex), sourceSpan.start.moveBy(onIndex + "on".length));
  const prefetchSpan = getPrefetchSpan(expression, sourceSpan);
  const hydrateSpan = getHydrateSpan(expression, sourceSpan);
  if (onIndex === -1) {
    errors.push(new ParseError(sourceSpan, `Could not find "on" keyword in expression`));
  } else {
    const start = getTriggerParametersStart(expression, onIndex + 1);
    const parser = new OnTriggerParser(expression, start, sourceSpan, triggers, errors, expression.startsWith("hydrate") ? validateHydrateReferenceBasedTrigger : validatePlainReferenceBasedTrigger, placeholder, prefetchSpan, onSourceSpan, hydrateSpan);
    parser.parse();
  }
}
function getPrefetchSpan(expression, sourceSpan) {
  if (!expression.startsWith("prefetch")) {
    return null;
  }
  return new ParseSourceSpan(sourceSpan.start, sourceSpan.start.moveBy("prefetch".length));
}
function getHydrateSpan(expression, sourceSpan) {
  if (!expression.startsWith("hydrate")) {
    return null;
  }
  return new ParseSourceSpan(sourceSpan.start, sourceSpan.start.moveBy("hydrate".length));
}
class OnTriggerParser {
  expression;
  start;
  span;
  triggers;
  errors;
  validator;
  placeholder;
  prefetchSpan;
  onSourceSpan;
  hydrateSpan;
  index = 0;
  tokens;
  constructor(expression, start, span, triggers, errors, validator, placeholder, prefetchSpan, onSourceSpan, hydrateSpan) {
    this.expression = expression;
    this.start = start;
    this.span = span;
    this.triggers = triggers;
    this.errors = errors;
    this.validator = validator;
    this.placeholder = placeholder;
    this.prefetchSpan = prefetchSpan;
    this.onSourceSpan = onSourceSpan;
    this.hydrateSpan = hydrateSpan;
    this.tokens = new Lexer().tokenize(expression.slice(start));
  }
  parse() {
    while (this.tokens.length > 0 && this.index < this.tokens.length) {
      const token = this.token();
      if (!token.isIdentifier()) {
        this.unexpectedToken(token);
        break;
      }
      if (this.isFollowedByOrLast($COMMA)) {
        this.consumeTrigger(token, []);
        this.advance();
      } else if (this.isFollowedByOrLast($LPAREN)) {
        this.advance();
        const prevErrors = this.errors.length;
        const parameters = this.consumeParameters();
        if (this.errors.length !== prevErrors) {
          break;
        }
        this.consumeTrigger(token, parameters);
        this.advance();
      } else if (this.index < this.tokens.length - 1) {
        this.unexpectedToken(this.tokens[this.index + 1]);
      }
      this.advance();
    }
  }
  advance() {
    this.index++;
  }
  isFollowedByOrLast(char) {
    if (this.index === this.tokens.length - 1) {
      return true;
    }
    return this.tokens[this.index + 1].isCharacter(char);
  }
  token() {
    return this.tokens[Math.min(this.index, this.tokens.length - 1)];
  }
  consumeTrigger(identifier, parameters) {
    const triggerNameStartSpan = this.span.start.moveBy(this.start + identifier.index - this.tokens[0].index);
    const nameSpan = new ParseSourceSpan(triggerNameStartSpan, triggerNameStartSpan.moveBy(identifier.strValue.length));
    const endSpan = triggerNameStartSpan.moveBy(this.token().end - identifier.index);
    const isFirstTrigger = identifier.index === 0;
    const onSourceSpan = isFirstTrigger ? this.onSourceSpan : null;
    const prefetchSourceSpan = isFirstTrigger ? this.prefetchSpan : null;
    const hydrateSourceSpan = isFirstTrigger ? this.hydrateSpan : null;
    const sourceSpan = new ParseSourceSpan(isFirstTrigger ? this.span.start : triggerNameStartSpan, endSpan);
    try {
      switch (identifier.toString()) {
        case OnTriggerType.IDLE:
          this.trackTrigger("idle", createIdleTrigger(parameters, nameSpan, sourceSpan, prefetchSourceSpan, onSourceSpan, hydrateSourceSpan));
          break;
        case OnTriggerType.TIMER:
          this.trackTrigger("timer", createTimerTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan, this.hydrateSpan));
          break;
        case OnTriggerType.INTERACTION:
          this.trackTrigger("interaction", createInteractionTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan, this.hydrateSpan, this.placeholder, this.validator));
          break;
        case OnTriggerType.IMMEDIATE:
          this.trackTrigger("immediate", createImmediateTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan, this.hydrateSpan));
          break;
        case OnTriggerType.HOVER:
          this.trackTrigger("hover", createHoverTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan, this.hydrateSpan, this.placeholder, this.validator));
          break;
        case OnTriggerType.VIEWPORT:
          this.trackTrigger("viewport", createViewportTrigger(parameters, nameSpan, sourceSpan, this.prefetchSpan, this.onSourceSpan, this.hydrateSpan, this.placeholder, this.validator));
          break;
        default:
          throw new Error(`Unrecognized trigger type "${identifier}"`);
      }
    } catch (e) {
      this.error(identifier, e.message);
    }
  }
  consumeParameters() {
    const parameters = [];
    if (!this.token().isCharacter($LPAREN)) {
      this.unexpectedToken(this.token());
      return parameters;
    }
    this.advance();
    const commaDelimStack = [];
    let current = "";
    while (this.index < this.tokens.length) {
      const token = this.token();
      if (token.isCharacter($RPAREN) && commaDelimStack.length === 0) {
        if (current.length) {
          parameters.push(current);
        }
        break;
      }
      if (token.type === TokenType.Character && COMMA_DELIMITED_SYNTAX.has(token.numValue)) {
        commaDelimStack.push(COMMA_DELIMITED_SYNTAX.get(token.numValue));
      }
      if (commaDelimStack.length > 0 && token.isCharacter(commaDelimStack[commaDelimStack.length - 1])) {
        commaDelimStack.pop();
      }
      if (commaDelimStack.length === 0 && token.isCharacter($COMMA) && current.length > 0) {
        parameters.push(current);
        current = "";
        this.advance();
        continue;
      }
      current += this.tokenText();
      this.advance();
    }
    if (!this.token().isCharacter($RPAREN) || commaDelimStack.length > 0) {
      this.error(this.token(), "Unexpected end of expression");
    }
    if (this.index < this.tokens.length - 1 && !this.tokens[this.index + 1].isCharacter($COMMA)) {
      this.unexpectedToken(this.tokens[this.index + 1]);
    }
    return parameters;
  }
  tokenText() {
    return this.expression.slice(this.start + this.token().index, this.start + this.token().end);
  }
  trackTrigger(name, trigger) {
    trackTrigger(name, this.triggers, this.errors, trigger);
  }
  error(token, message) {
    const newStart = this.span.start.moveBy(this.start + token.index);
    const newEnd = newStart.moveBy(token.end - token.index);
    this.errors.push(new ParseError(new ParseSourceSpan(newStart, newEnd), message));
  }
  unexpectedToken(token) {
    this.error(token, `Unexpected token "${token}"`);
  }
}
function trackTrigger(name, allTriggers, errors, trigger) {
  if (allTriggers[name]) {
    errors.push(new ParseError(trigger.sourceSpan, `Duplicate "${name}" trigger is not allowed`));
  } else {
    allTriggers[name] = trigger;
  }
}
function createIdleTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
  if (parameters.length > 0) {
    throw new Error(`"${OnTriggerType.IDLE}" trigger cannot have parameters`);
  }
  return new IdleDeferredTrigger(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
}
function createTimerTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
  if (parameters.length !== 1) {
    throw new Error(`"${OnTriggerType.TIMER}" trigger must have exactly one parameter`);
  }
  const delay = parseDeferredTime(parameters[0]);
  if (delay === null) {
    throw new Error(`Could not parse time value of trigger "${OnTriggerType.TIMER}"`);
  }
  return new TimerDeferredTrigger(delay, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
}
function createImmediateTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan) {
  if (parameters.length > 0) {
    throw new Error(`"${OnTriggerType.IMMEDIATE}" trigger cannot have parameters`);
  }
  return new ImmediateDeferredTrigger(nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
}
function createHoverTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan, placeholder, validator) {
  validator(OnTriggerType.HOVER, parameters, placeholder);
  return new HoverDeferredTrigger(parameters[0] ?? null, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
}
function createInteractionTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan, placeholder, validator) {
  validator(OnTriggerType.INTERACTION, parameters, placeholder);
  return new InteractionDeferredTrigger(parameters[0] ?? null, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
}
function createViewportTrigger(parameters, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan, placeholder, validator) {
  validator(OnTriggerType.VIEWPORT, parameters, placeholder);
  return new ViewportDeferredTrigger(parameters[0] ?? null, nameSpan, sourceSpan, prefetchSpan, onSourceSpan, hydrateSpan);
}
function validatePlainReferenceBasedTrigger(type, parameters, placeholder) {
  if (parameters.length > 1) {
    throw new Error(`"${type}" trigger can only have zero or one parameters`);
  }
  if (parameters.length === 0) {
    if (placeholder === null) {
      throw new Error(`"${type}" trigger with no parameters can only be placed on an @defer that has a @placeholder block`);
    }
    if (placeholder.children.length !== 1 || !(placeholder.children[0] instanceof Element$1)) {
      throw new Error(`"${type}" trigger with no parameters can only be placed on an @defer that has a @placeholder block with exactly one root element node`);
    }
  }
}
function validateHydrateReferenceBasedTrigger(type, parameters) {
  if (parameters.length > 0) {
    throw new Error(`Hydration trigger "${type}" cannot have parameters`);
  }
}
function getTriggerParametersStart(value, startPosition = 0) {
  let hasFoundSeparator = false;
  for (let i = startPosition; i < value.length; i++) {
    if (SEPARATOR_PATTERN.test(value[i])) {
      hasFoundSeparator = true;
    } else if (hasFoundSeparator) {
      return i;
    }
  }
  return -1;
}
function parseDeferredTime(value) {
  const match = value.match(TIME_PATTERN);
  if (!match) {
    return null;
  }
  const [time, units] = match;
  return parseFloat(time) * (units === "s" ? 1e3 : 1);
}
const PREFETCH_WHEN_PATTERN = /^prefetch\s+when\s/;
const PREFETCH_ON_PATTERN = /^prefetch\s+on\s/;
const HYDRATE_WHEN_PATTERN = /^hydrate\s+when\s/;
const HYDRATE_ON_PATTERN = /^hydrate\s+on\s/;
const HYDRATE_NEVER_PATTERN = /^hydrate\s+never(\s*)$/;
const MINIMUM_PARAMETER_PATTERN = /^minimum\s/;
const AFTER_PARAMETER_PATTERN = /^after\s/;
const WHEN_PARAMETER_PATTERN = /^when\s/;
const ON_PARAMETER_PATTERN = /^on\s/;
function isConnectedDeferLoopBlock(name) {
  return name === "placeholder" || name === "loading" || name === "error";
}
function createDeferredBlock(ast, connectedBlocks, visitor, bindingParser) {
  const errors = [];
  const { placeholder, loading, error: error2 } = parseConnectedBlocks(connectedBlocks, errors, visitor);
  const { triggers, prefetchTriggers, hydrateTriggers } = parsePrimaryTriggers(ast, bindingParser, errors, placeholder);
  let lastEndSourceSpan = ast.endSourceSpan;
  let endOfLastSourceSpan = ast.sourceSpan.end;
  if (connectedBlocks.length > 0) {
    const lastConnectedBlock = connectedBlocks[connectedBlocks.length - 1];
    lastEndSourceSpan = lastConnectedBlock.endSourceSpan;
    endOfLastSourceSpan = lastConnectedBlock.sourceSpan.end;
  }
  const sourceSpanWithConnectedBlocks = new ParseSourceSpan(ast.sourceSpan.start, endOfLastSourceSpan);
  const node = new DeferredBlock(visitAll(visitor, ast.children, ast.children), triggers, prefetchTriggers, hydrateTriggers, placeholder, loading, error2, ast.nameSpan, sourceSpanWithConnectedBlocks, ast.sourceSpan, ast.startSourceSpan, lastEndSourceSpan, ast.i18n);
  return { node, errors };
}
function parseConnectedBlocks(connectedBlocks, errors, visitor) {
  let placeholder = null;
  let loading = null;
  let error2 = null;
  for (const block of connectedBlocks) {
    try {
      if (!isConnectedDeferLoopBlock(block.name)) {
        errors.push(new ParseError(block.startSourceSpan, `Unrecognized block "@${block.name}"`));
        break;
      }
      switch (block.name) {
        case "placeholder":
          if (placeholder !== null) {
            errors.push(new ParseError(block.startSourceSpan, `@defer block can only have one @placeholder block`));
          } else {
            placeholder = parsePlaceholderBlock(block, visitor);
          }
          break;
        case "loading":
          if (loading !== null) {
            errors.push(new ParseError(block.startSourceSpan, `@defer block can only have one @loading block`));
          } else {
            loading = parseLoadingBlock(block, visitor);
          }
          break;
        case "error":
          if (error2 !== null) {
            errors.push(new ParseError(block.startSourceSpan, `@defer block can only have one @error block`));
          } else {
            error2 = parseErrorBlock(block, visitor);
          }
          break;
      }
    } catch (e) {
      errors.push(new ParseError(block.startSourceSpan, e.message));
    }
  }
  return { placeholder, loading, error: error2 };
}
function parsePlaceholderBlock(ast, visitor) {
  let minimumTime = null;
  for (const param of ast.parameters) {
    if (MINIMUM_PARAMETER_PATTERN.test(param.expression)) {
      if (minimumTime != null) {
        throw new Error(`@placeholder block can only have one "minimum" parameter`);
      }
      const parsedTime = parseDeferredTime(param.expression.slice(getTriggerParametersStart(param.expression)));
      if (parsedTime === null) {
        throw new Error(`Could not parse time value of parameter "minimum"`);
      }
      minimumTime = parsedTime;
    } else {
      throw new Error(`Unrecognized parameter in @placeholder block: "${param.expression}"`);
    }
  }
  return new DeferredBlockPlaceholder(visitAll(visitor, ast.children, ast.children), minimumTime, ast.nameSpan, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.i18n);
}
function parseLoadingBlock(ast, visitor) {
  let afterTime = null;
  let minimumTime = null;
  for (const param of ast.parameters) {
    if (AFTER_PARAMETER_PATTERN.test(param.expression)) {
      if (afterTime != null) {
        throw new Error(`@loading block can only have one "after" parameter`);
      }
      const parsedTime = parseDeferredTime(param.expression.slice(getTriggerParametersStart(param.expression)));
      if (parsedTime === null) {
        throw new Error(`Could not parse time value of parameter "after"`);
      }
      afterTime = parsedTime;
    } else if (MINIMUM_PARAMETER_PATTERN.test(param.expression)) {
      if (minimumTime != null) {
        throw new Error(`@loading block can only have one "minimum" parameter`);
      }
      const parsedTime = parseDeferredTime(param.expression.slice(getTriggerParametersStart(param.expression)));
      if (parsedTime === null) {
        throw new Error(`Could not parse time value of parameter "minimum"`);
      }
      minimumTime = parsedTime;
    } else {
      throw new Error(`Unrecognized parameter in @loading block: "${param.expression}"`);
    }
  }
  return new DeferredBlockLoading(visitAll(visitor, ast.children, ast.children), afterTime, minimumTime, ast.nameSpan, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.i18n);
}
function parseErrorBlock(ast, visitor) {
  if (ast.parameters.length > 0) {
    throw new Error(`@error block cannot have parameters`);
  }
  return new DeferredBlockError(visitAll(visitor, ast.children, ast.children), ast.nameSpan, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan, ast.i18n);
}
function parsePrimaryTriggers(ast, bindingParser, errors, placeholder) {
  const triggers = {};
  const prefetchTriggers = {};
  const hydrateTriggers = {};
  for (const param of ast.parameters) {
    if (WHEN_PARAMETER_PATTERN.test(param.expression)) {
      parseWhenTrigger(param, bindingParser, triggers, errors);
    } else if (ON_PARAMETER_PATTERN.test(param.expression)) {
      parseOnTrigger(param, triggers, errors, placeholder);
    } else if (PREFETCH_WHEN_PATTERN.test(param.expression)) {
      parseWhenTrigger(param, bindingParser, prefetchTriggers, errors);
    } else if (PREFETCH_ON_PATTERN.test(param.expression)) {
      parseOnTrigger(param, prefetchTriggers, errors, placeholder);
    } else if (HYDRATE_WHEN_PATTERN.test(param.expression)) {
      parseWhenTrigger(param, bindingParser, hydrateTriggers, errors);
    } else if (HYDRATE_ON_PATTERN.test(param.expression)) {
      parseOnTrigger(param, hydrateTriggers, errors, placeholder);
    } else if (HYDRATE_NEVER_PATTERN.test(param.expression)) {
      parseNeverTrigger(param, hydrateTriggers, errors);
    } else {
      errors.push(new ParseError(param.sourceSpan, "Unrecognized trigger"));
    }
  }
  if (hydrateTriggers.never && Object.keys(hydrateTriggers).length > 1) {
    errors.push(new ParseError(ast.startSourceSpan, "Cannot specify additional `hydrate` triggers if `hydrate never` is present"));
  }
  return { triggers, prefetchTriggers, hydrateTriggers };
}
const BIND_NAME_REGEXP = /^(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.*)$/;
const KW_BIND_IDX = 1;
const KW_LET_IDX = 2;
const KW_REF_IDX = 3;
const KW_ON_IDX = 4;
const KW_BINDON_IDX = 5;
const KW_AT_IDX = 6;
const IDENT_KW_IDX = 7;
const BINDING_DELIMS = {
  BANANA_BOX: { start: "[(", end: ")]" },
  PROPERTY: { start: "[", end: "]" },
  EVENT: { start: "(", end: ")" }
};
const TEMPLATE_ATTR_PREFIX = "*";
function htmlAstToRender3Ast(htmlNodes, bindingParser, options) {
  const transformer = new HtmlAstToIvyAst(bindingParser, options);
  const ivyNodes = visitAll(transformer, htmlNodes, htmlNodes);
  const allErrors = bindingParser.errors.concat(transformer.errors);
  const result = {
    nodes: ivyNodes,
    errors: allErrors,
    styleUrls: transformer.styleUrls,
    styles: transformer.styles,
    ngContentSelectors: transformer.ngContentSelectors
  };
  if (options.collectCommentNodes) {
    result.commentNodes = transformer.commentNodes;
  }
  return result;
}
class HtmlAstToIvyAst {
  bindingParser;
  options;
  errors = [];
  styles = [];
  styleUrls = [];
  ngContentSelectors = [];
  // This array will be populated if `Render3ParseOptions['collectCommentNodes']` is true
  commentNodes = [];
  inI18nBlock = false;
  /**
   * Keeps track of the nodes that have been processed already when previous nodes were visited.
   * These are typically blocks connected to other blocks or text nodes between connected blocks.
   */
  processedNodes = /* @__PURE__ */ new Set();
  constructor(bindingParser, options) {
    this.bindingParser = bindingParser;
    this.options = options;
  }
  // HTML visitor
  visitElement(element2) {
    const isI18nRootElement = isI18nRootNode(element2.i18n);
    if (isI18nRootElement) {
      if (this.inI18nBlock) {
        this.reportError("Cannot mark an element as translatable inside of a translatable section. Please remove the nested i18n marker.", element2.sourceSpan);
      }
      this.inI18nBlock = true;
    }
    const preparsedElement = preparseElement(element2);
    if (preparsedElement.type === PreparsedElementType.SCRIPT) {
      return null;
    } else if (preparsedElement.type === PreparsedElementType.STYLE) {
      const contents = textContents(element2);
      if (contents !== null) {
        this.styles.push(contents);
      }
      return null;
    } else if (preparsedElement.type === PreparsedElementType.STYLESHEET && isStyleUrlResolvable(preparsedElement.hrefAttr)) {
      this.styleUrls.push(preparsedElement.hrefAttr);
      return null;
    }
    const isTemplateElement = isNgTemplate(element2.name);
    const parsedProperties = [];
    const boundEvents = [];
    const variables = [];
    const references = [];
    const attributes = [];
    const i18nAttrsMeta = {};
    const templateParsedProperties = [];
    const templateVariables = [];
    let elementHasInlineTemplate = false;
    for (const attribute2 of element2.attrs) {
      let hasBinding = false;
      const normalizedName = normalizeAttributeName(attribute2.name);
      let isTemplateBinding = false;
      if (attribute2.i18n) {
        i18nAttrsMeta[attribute2.name] = attribute2.i18n;
      }
      if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
        if (elementHasInlineTemplate) {
          this.reportError(`Can't have multiple template bindings on one element. Use only one attribute prefixed with *`, attribute2.sourceSpan);
        }
        isTemplateBinding = true;
        elementHasInlineTemplate = true;
        const templateValue = attribute2.value;
        const templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
        const parsedVariables = [];
        const absoluteValueOffset = attribute2.valueSpan ? attribute2.valueSpan.start.offset : (
          // If there is no value span the attribute does not have a value, like `attr` in
          //`<div attr></div>`. In this case, point to one character beyond the last character of
          // the attribute name.
          attribute2.sourceSpan.start.offset + attribute2.name.length
        );
        this.bindingParser.parseInlineTemplateBinding(
          templateKey,
          templateValue,
          attribute2.sourceSpan,
          absoluteValueOffset,
          [],
          templateParsedProperties,
          parsedVariables,
          true
          /* isIvyAst */
        );
        templateVariables.push(...parsedVariables.map((v) => new Variable(v.name, v.value, v.sourceSpan, v.keySpan, v.valueSpan)));
      } else {
        hasBinding = this.parseAttribute(isTemplateElement, attribute2, [], parsedProperties, boundEvents, variables, references);
      }
      if (!hasBinding && !isTemplateBinding) {
        attributes.push(this.visitAttribute(attribute2));
      }
    }
    let children;
    if (preparsedElement.nonBindable) {
      children = visitAll(NON_BINDABLE_VISITOR, element2.children).flat(Infinity);
    } else {
      children = visitAll(this, element2.children, element2.children);
    }
    let parsedElement;
    if (preparsedElement.type === PreparsedElementType.NG_CONTENT) {
      const selector = preparsedElement.selectAttr;
      const attrs = element2.attrs.map((attr) => this.visitAttribute(attr));
      parsedElement = new Content(selector, attrs, children, element2.sourceSpan, element2.i18n);
      this.ngContentSelectors.push(selector);
    } else if (isTemplateElement) {
      const attrs = this.extractAttributes(element2.name, parsedProperties, i18nAttrsMeta);
      parsedElement = new Template(element2.name, attributes, attrs.bound, boundEvents, [
        /* no template attributes */
      ], children, references, variables, element2.sourceSpan, element2.startSourceSpan, element2.endSourceSpan, element2.i18n);
    } else {
      const attrs = this.extractAttributes(element2.name, parsedProperties, i18nAttrsMeta);
      parsedElement = new Element$1(element2.name, attributes, attrs.bound, boundEvents, children, references, element2.sourceSpan, element2.startSourceSpan, element2.endSourceSpan, element2.i18n);
    }
    if (elementHasInlineTemplate) {
      const attrs = this.extractAttributes("ng-template", templateParsedProperties, i18nAttrsMeta);
      const templateAttrs = [];
      attrs.literal.forEach((attr) => templateAttrs.push(attr));
      attrs.bound.forEach((attr) => templateAttrs.push(attr));
      const hoistedAttrs = parsedElement instanceof Element$1 ? {
        attributes: parsedElement.attributes,
        inputs: parsedElement.inputs,
        outputs: parsedElement.outputs
      } : { attributes: [], inputs: [], outputs: [] };
      const i18n2 = isTemplateElement && isI18nRootElement ? void 0 : element2.i18n;
      const name = parsedElement instanceof Template ? null : parsedElement.name;
      parsedElement = new Template(name, hoistedAttrs.attributes, hoistedAttrs.inputs, hoistedAttrs.outputs, templateAttrs, [parsedElement], [
        /* no references */
      ], templateVariables, element2.sourceSpan, element2.startSourceSpan, element2.endSourceSpan, i18n2);
    }
    if (isI18nRootElement) {
      this.inI18nBlock = false;
    }
    return parsedElement;
  }
  visitAttribute(attribute2) {
    return new TextAttribute(attribute2.name, attribute2.value, attribute2.sourceSpan, attribute2.keySpan, attribute2.valueSpan, attribute2.i18n);
  }
  visitText(text2) {
    return this.processedNodes.has(text2) ? null : this._visitTextWithInterpolation(text2.value, text2.sourceSpan, text2.tokens, text2.i18n);
  }
  visitExpansion(expansion) {
    if (!expansion.i18n) {
      return null;
    }
    if (!isI18nRootNode(expansion.i18n)) {
      throw new Error(`Invalid type "${expansion.i18n.constructor}" for "i18n" property of ${expansion.sourceSpan.toString()}. Expected a "Message"`);
    }
    const message = expansion.i18n;
    const vars = {};
    const placeholders = {};
    Object.keys(message.placeholders).forEach((key) => {
      const value = message.placeholders[key];
      if (key.startsWith(I18N_ICU_VAR_PREFIX)) {
        const formattedKey = key.trim();
        const ast = this.bindingParser.parseInterpolationExpression(value.text, value.sourceSpan);
        vars[formattedKey] = new BoundText(ast, value.sourceSpan);
      } else {
        placeholders[key] = this._visitTextWithInterpolation(value.text, value.sourceSpan, null);
      }
    });
    return new Icu$1(vars, placeholders, expansion.sourceSpan, message);
  }
  visitExpansionCase(expansionCase) {
    return null;
  }
  visitComment(comment) {
    if (this.options.collectCommentNodes) {
      this.commentNodes.push(new Comment$1(comment.value || "", comment.sourceSpan));
    }
    return null;
  }
  visitLetDeclaration(decl, context) {
    const value = this.bindingParser.parseBinding(decl.value, false, decl.valueSpan, decl.valueSpan.start.offset);
    if (value.errors.length === 0 && value.ast instanceof EmptyExpr$1) {
      this.reportError("@let declaration value cannot be empty", decl.valueSpan);
    }
    return new LetDeclaration$1(decl.name, value, decl.sourceSpan, decl.nameSpan, decl.valueSpan);
  }
  visitBlockParameter() {
    return null;
  }
  visitBlock(block, context) {
    const index = Array.isArray(context) ? context.indexOf(block) : -1;
    if (index === -1) {
      throw new Error("Visitor invoked incorrectly. Expecting visitBlock to be invoked siblings array as its context");
    }
    if (this.processedNodes.has(block)) {
      return null;
    }
    let result = null;
    switch (block.name) {
      case "defer":
        result = createDeferredBlock(block, this.findConnectedBlocks(index, context, isConnectedDeferLoopBlock), this, this.bindingParser);
        break;
      case "switch":
        result = createSwitchBlock(block, this, this.bindingParser);
        break;
      case "for":
        result = createForLoop(block, this.findConnectedBlocks(index, context, isConnectedForLoopBlock), this, this.bindingParser);
        break;
      case "if":
        result = createIfBlock(block, this.findConnectedBlocks(index, context, isConnectedIfLoopBlock), this, this.bindingParser);
        break;
      default:
        let errorMessage;
        if (isConnectedDeferLoopBlock(block.name)) {
          errorMessage = `@${block.name} block can only be used after an @defer block.`;
          this.processedNodes.add(block);
        } else if (isConnectedForLoopBlock(block.name)) {
          errorMessage = `@${block.name} block can only be used after an @for block.`;
          this.processedNodes.add(block);
        } else if (isConnectedIfLoopBlock(block.name)) {
          errorMessage = `@${block.name} block can only be used after an @if or @else if block.`;
          this.processedNodes.add(block);
        } else {
          errorMessage = `Unrecognized block @${block.name}.`;
        }
        result = {
          node: new UnknownBlock(block.name, block.sourceSpan, block.nameSpan),
          errors: [new ParseError(block.sourceSpan, errorMessage)]
        };
        break;
    }
    this.errors.push(...result.errors);
    return result.node;
  }
  findConnectedBlocks(primaryBlockIndex, siblings, predicate) {
    const relatedBlocks = [];
    for (let i = primaryBlockIndex + 1; i < siblings.length; i++) {
      const node = siblings[i];
      if (node instanceof Comment) {
        continue;
      }
      if (node instanceof Text && node.value.trim().length === 0) {
        this.processedNodes.add(node);
        continue;
      }
      if (!(node instanceof Block) || !predicate(node.name)) {
        break;
      }
      relatedBlocks.push(node);
      this.processedNodes.add(node);
    }
    return relatedBlocks;
  }
  // convert view engine `ParsedProperty` to a format suitable for IVY
  extractAttributes(elementName, properties, i18nPropsMeta) {
    const bound = [];
    const literal2 = [];
    properties.forEach((prop) => {
      const i18n2 = i18nPropsMeta[prop.name];
      if (prop.isLiteral) {
        literal2.push(new TextAttribute(prop.name, prop.expression.source || "", prop.sourceSpan, prop.keySpan, prop.valueSpan, i18n2));
      } else {
        const bep = this.bindingParser.createBoundElementProperty(
          elementName,
          prop,
          /* skipValidation */
          true,
          /* mapPropertyName */
          false
        );
        bound.push(BoundAttribute.fromBoundElementProperty(bep, i18n2));
      }
    });
    return { bound, literal: literal2 };
  }
  parseAttribute(isTemplateElement, attribute2, matchableAttributes, parsedProperties, boundEvents, variables, references) {
    const name = normalizeAttributeName(attribute2.name);
    const value = attribute2.value;
    const srcSpan = attribute2.sourceSpan;
    const absoluteOffset = attribute2.valueSpan ? attribute2.valueSpan.start.offset : srcSpan.start.offset;
    function createKeySpan(srcSpan2, prefix, identifier) {
      const normalizationAdjustment = attribute2.name.length - name.length;
      const keySpanStart = srcSpan2.start.moveBy(prefix.length + normalizationAdjustment);
      const keySpanEnd = keySpanStart.moveBy(identifier.length);
      return new ParseSourceSpan(keySpanStart, keySpanEnd, keySpanStart, identifier);
    }
    const bindParts = name.match(BIND_NAME_REGEXP);
    if (bindParts) {
      if (bindParts[KW_BIND_IDX] != null) {
        const identifier = bindParts[IDENT_KW_IDX];
        const keySpan2 = createKeySpan(srcSpan, bindParts[KW_BIND_IDX], identifier);
        this.bindingParser.parsePropertyBinding(identifier, value, false, false, srcSpan, absoluteOffset, attribute2.valueSpan, matchableAttributes, parsedProperties, keySpan2);
      } else if (bindParts[KW_LET_IDX]) {
        if (isTemplateElement) {
          const identifier = bindParts[IDENT_KW_IDX];
          const keySpan2 = createKeySpan(srcSpan, bindParts[KW_LET_IDX], identifier);
          this.parseVariable(identifier, value, srcSpan, keySpan2, attribute2.valueSpan, variables);
        } else {
          this.reportError(`"let-" is only supported on ng-template elements.`, srcSpan);
        }
      } else if (bindParts[KW_REF_IDX]) {
        const identifier = bindParts[IDENT_KW_IDX];
        const keySpan2 = createKeySpan(srcSpan, bindParts[KW_REF_IDX], identifier);
        this.parseReference(identifier, value, srcSpan, keySpan2, attribute2.valueSpan, references);
      } else if (bindParts[KW_ON_IDX]) {
        const events = [];
        const identifier = bindParts[IDENT_KW_IDX];
        const keySpan2 = createKeySpan(srcSpan, bindParts[KW_ON_IDX], identifier);
        this.bindingParser.parseEvent(
          identifier,
          value,
          /* isAssignmentEvent */
          false,
          srcSpan,
          attribute2.valueSpan || srcSpan,
          matchableAttributes,
          events,
          keySpan2
        );
        addEvents(events, boundEvents);
      } else if (bindParts[KW_BINDON_IDX]) {
        const identifier = bindParts[IDENT_KW_IDX];
        const keySpan2 = createKeySpan(srcSpan, bindParts[KW_BINDON_IDX], identifier);
        this.bindingParser.parsePropertyBinding(identifier, value, false, true, srcSpan, absoluteOffset, attribute2.valueSpan, matchableAttributes, parsedProperties, keySpan2);
        this.parseAssignmentEvent(identifier, value, srcSpan, attribute2.valueSpan, matchableAttributes, boundEvents, keySpan2);
      } else if (bindParts[KW_AT_IDX]) {
        const keySpan2 = createKeySpan(srcSpan, "", name);
        this.bindingParser.parseLiteralAttr(name, value, srcSpan, absoluteOffset, attribute2.valueSpan, matchableAttributes, parsedProperties, keySpan2);
      }
      return true;
    }
    let delims = null;
    if (name.startsWith(BINDING_DELIMS.BANANA_BOX.start)) {
      delims = BINDING_DELIMS.BANANA_BOX;
    } else if (name.startsWith(BINDING_DELIMS.PROPERTY.start)) {
      delims = BINDING_DELIMS.PROPERTY;
    } else if (name.startsWith(BINDING_DELIMS.EVENT.start)) {
      delims = BINDING_DELIMS.EVENT;
    }
    if (delims !== null && // NOTE: older versions of the parser would match a start/end delimited
    // binding iff the property name was terminated by the ending delimiter
    // and the identifier in the binding was non-empty.
    // TODO(ayazhafiz): update this to handle malformed bindings.
    name.endsWith(delims.end) && name.length > delims.start.length + delims.end.length) {
      const identifier = name.substring(delims.start.length, name.length - delims.end.length);
      const keySpan2 = createKeySpan(srcSpan, delims.start, identifier);
      if (delims.start === BINDING_DELIMS.BANANA_BOX.start) {
        this.bindingParser.parsePropertyBinding(identifier, value, false, true, srcSpan, absoluteOffset, attribute2.valueSpan, matchableAttributes, parsedProperties, keySpan2);
        this.parseAssignmentEvent(identifier, value, srcSpan, attribute2.valueSpan, matchableAttributes, boundEvents, keySpan2);
      } else if (delims.start === BINDING_DELIMS.PROPERTY.start) {
        this.bindingParser.parsePropertyBinding(identifier, value, false, false, srcSpan, absoluteOffset, attribute2.valueSpan, matchableAttributes, parsedProperties, keySpan2);
      } else {
        const events = [];
        this.bindingParser.parseEvent(
          identifier,
          value,
          /* isAssignmentEvent */
          false,
          srcSpan,
          attribute2.valueSpan || srcSpan,
          matchableAttributes,
          events,
          keySpan2
        );
        addEvents(events, boundEvents);
      }
      return true;
    }
    const keySpan = createKeySpan(srcSpan, "", name);
    const hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, attribute2.valueSpan, matchableAttributes, parsedProperties, keySpan, attribute2.valueTokens ?? null);
    return hasBinding;
  }
  _visitTextWithInterpolation(value, sourceSpan, interpolatedTokens, i18n2) {
    const valueNoNgsp = replaceNgsp(value);
    const expr = this.bindingParser.parseInterpolation(valueNoNgsp, sourceSpan, interpolatedTokens);
    return expr ? new BoundText(expr, sourceSpan, i18n2) : new Text$3(valueNoNgsp, sourceSpan);
  }
  parseVariable(identifier, value, sourceSpan, keySpan, valueSpan, variables) {
    if (identifier.indexOf("-") > -1) {
      this.reportError(`"-" is not allowed in variable names`, sourceSpan);
    } else if (identifier.length === 0) {
      this.reportError(`Variable does not have a name`, sourceSpan);
    }
    variables.push(new Variable(identifier, value, sourceSpan, keySpan, valueSpan));
  }
  parseReference(identifier, value, sourceSpan, keySpan, valueSpan, references) {
    if (identifier.indexOf("-") > -1) {
      this.reportError(`"-" is not allowed in reference names`, sourceSpan);
    } else if (identifier.length === 0) {
      this.reportError(`Reference does not have a name`, sourceSpan);
    } else if (references.some((reference2) => reference2.name === identifier)) {
      this.reportError(`Reference "#${identifier}" is defined more than once`, sourceSpan);
    }
    references.push(new Reference(identifier, value, sourceSpan, keySpan, valueSpan));
  }
  parseAssignmentEvent(name, expression, sourceSpan, valueSpan, targetMatchableAttrs, boundEvents, keySpan) {
    const events = [];
    this.bindingParser.parseEvent(
      `${name}Change`,
      expression,
      /* isAssignmentEvent */
      true,
      sourceSpan,
      valueSpan || sourceSpan,
      targetMatchableAttrs,
      events,
      keySpan
    );
    addEvents(events, boundEvents);
  }
  reportError(message, sourceSpan, level = ParseErrorLevel.ERROR) {
    this.errors.push(new ParseError(sourceSpan, message, level));
  }
}
class NonBindableVisitor {
  visitElement(ast) {
    const preparsedElement = preparseElement(ast);
    if (preparsedElement.type === PreparsedElementType.SCRIPT || preparsedElement.type === PreparsedElementType.STYLE || preparsedElement.type === PreparsedElementType.STYLESHEET) {
      return null;
    }
    const children = visitAll(this, ast.children, null);
    return new Element$1(
      ast.name,
      visitAll(this, ast.attrs),
      /* inputs */
      [],
      /* outputs */
      [],
      children,
      /* references */
      [],
      ast.sourceSpan,
      ast.startSourceSpan,
      ast.endSourceSpan
    );
  }
  visitComment(comment) {
    return null;
  }
  visitAttribute(attribute2) {
    return new TextAttribute(attribute2.name, attribute2.value, attribute2.sourceSpan, attribute2.keySpan, attribute2.valueSpan, attribute2.i18n);
  }
  visitText(text2) {
    return new Text$3(text2.value, text2.sourceSpan);
  }
  visitExpansion(expansion) {
    return null;
  }
  visitExpansionCase(expansionCase) {
    return null;
  }
  visitBlock(block, context) {
    const nodes = [
      // In an ngNonBindable context we treat the opening/closing tags of block as plain text.
      // This is the as if the `tokenizeBlocks` option was disabled.
      new Text$3(block.startSourceSpan.toString(), block.startSourceSpan),
      ...visitAll(this, block.children)
    ];
    if (block.endSourceSpan !== null) {
      nodes.push(new Text$3(block.endSourceSpan.toString(), block.endSourceSpan));
    }
    return nodes;
  }
  visitBlockParameter(parameter, context) {
    return null;
  }
  visitLetDeclaration(decl, context) {
    return new Text$3(`@let ${decl.name} = ${decl.value};`, decl.sourceSpan);
  }
}
const NON_BINDABLE_VISITOR = new NonBindableVisitor();
function normalizeAttributeName(attrName) {
  return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
}
function addEvents(events, boundEvents) {
  boundEvents.push(...events.map((e) => BoundEvent.fromParsedEvent(e)));
}
function textContents(node) {
  if (node.children.length !== 1 || !(node.children[0] instanceof Text)) {
    return null;
  } else {
    return node.children[0].value;
  }
}
const LEADING_TRIVIA_CHARS = [" ", "\n", "\r", "	"];
function parseTemplate(template2, templateUrl, options = {}) {
  const { interpolationConfig, preserveWhitespaces, enableI18nLegacyMessageIdFormat } = options;
  const bindingParser = makeBindingParser(interpolationConfig);
  const htmlParser = new HtmlParser();
  const parseResult = htmlParser.parse(template2, templateUrl, {
    leadingTriviaChars: LEADING_TRIVIA_CHARS,
    ...options,
    tokenizeExpansionForms: true,
    tokenizeBlocks: options.enableBlockSyntax ?? true,
    tokenizeLet: options.enableLetSyntax ?? true
  });
  if (!options.alwaysAttemptHtmlToR3AstConversion && parseResult.errors && parseResult.errors.length > 0) {
    const parsedTemplate2 = {
      interpolationConfig,
      preserveWhitespaces,
      errors: parseResult.errors,
      nodes: [],
      styleUrls: [],
      styles: [],
      ngContentSelectors: []
    };
    if (options.collectCommentNodes) {
      parsedTemplate2.commentNodes = [];
    }
    return parsedTemplate2;
  }
  let rootNodes = parseResult.rootNodes;
  const retainEmptyTokens = !(options.preserveSignificantWhitespace ?? true);
  const i18nMetaVisitor = new I18nMetaVisitor(
    interpolationConfig,
    /* keepI18nAttrs */
    !preserveWhitespaces,
    enableI18nLegacyMessageIdFormat,
    /* containerBlocks */
    void 0,
    options.preserveSignificantWhitespace,
    retainEmptyTokens
  );
  const i18nMetaResult = i18nMetaVisitor.visitAllWithErrors(rootNodes);
  if (!options.alwaysAttemptHtmlToR3AstConversion && i18nMetaResult.errors && i18nMetaResult.errors.length > 0) {
    const parsedTemplate2 = {
      interpolationConfig,
      preserveWhitespaces,
      errors: i18nMetaResult.errors,
      nodes: [],
      styleUrls: [],
      styles: [],
      ngContentSelectors: []
    };
    if (options.collectCommentNodes) {
      parsedTemplate2.commentNodes = [];
    }
    return parsedTemplate2;
  }
  rootNodes = i18nMetaResult.rootNodes;
  if (!preserveWhitespaces) {
    rootNodes = visitAll(new WhitespaceVisitor(
      /* preserveSignificantWhitespace */
      true,
      /* originalNodeMap */
      void 0,
      /* requireContext */
      false
    ), rootNodes);
    if (i18nMetaVisitor.hasI18nMeta) {
      rootNodes = visitAll(new I18nMetaVisitor(
        interpolationConfig,
        /* keepI18nAttrs */
        false,
        /* enableI18nLegacyMessageIdFormat */
        void 0,
        /* containerBlocks */
        void 0,
        /* preserveSignificantWhitespace */
        true,
        retainEmptyTokens
      ), rootNodes);
    }
  }
  const { nodes, errors, styleUrls, styles, ngContentSelectors, commentNodes } = htmlAstToRender3Ast(rootNodes, bindingParser, { collectCommentNodes: !!options.collectCommentNodes });
  errors.push(...parseResult.errors, ...i18nMetaResult.errors);
  const parsedTemplate = {
    interpolationConfig,
    preserveWhitespaces,
    errors: errors.length > 0 ? errors : null,
    nodes,
    styleUrls,
    styles,
    ngContentSelectors
  };
  if (options.collectCommentNodes) {
    parsedTemplate.commentNodes = commentNodes;
  }
  return parsedTemplate;
}
const elementRegistry = new DomElementSchemaRegistry();
function makeBindingParser(interpolationConfig = DEFAULT_INTERPOLATION_CONFIG) {
  return new BindingParser(new Parser(new Lexer()), interpolationConfig, elementRegistry, []);
}
const COMPONENT_VARIABLE = "%COMP%";
const HOST_ATTR = `_nghost-${COMPONENT_VARIABLE}`;
const CONTENT_ATTR = `_ngcontent-${COMPONENT_VARIABLE}`;
function baseDirectiveFields(meta, constantPool, bindingParser) {
  const definitionMap = new DefinitionMap();
  const selectors = parseSelectorToR3Selector(meta.selector);
  definitionMap.set("type", meta.type.value);
  if (selectors.length > 0) {
    definitionMap.set("selectors", asLiteral(selectors));
  }
  if (meta.queries.length > 0) {
    definitionMap.set("contentQueries", createContentQueriesFunction(meta.queries, constantPool, meta.name));
  }
  if (meta.viewQueries.length) {
    definitionMap.set("viewQuery", createViewQueriesFunction(meta.viewQueries, constantPool, meta.name));
  }
  definitionMap.set("hostBindings", createHostBindingsFunction(meta.host, meta.typeSourceSpan, bindingParser, constantPool, meta.selector || "", meta.name, definitionMap));
  definitionMap.set("inputs", conditionallyCreateDirectiveBindingLiteral(meta.inputs, true));
  definitionMap.set("outputs", conditionallyCreateDirectiveBindingLiteral(meta.outputs));
  if (meta.exportAs !== null) {
    definitionMap.set("exportAs", literalArr(meta.exportAs.map((e) => literal(e))));
  }
  if (meta.isStandalone === false) {
    definitionMap.set("standalone", literal(false));
  }
  if (meta.isSignal) {
    definitionMap.set("signals", literal(true));
  }
  return definitionMap;
}
function addFeatures(definitionMap, meta) {
  const features = [];
  const providers = meta.providers;
  const viewProviders = meta.viewProviders;
  const inputKeys = Object.keys(meta.inputs);
  if (providers || viewProviders) {
    const args = [providers || new LiteralArrayExpr([])];
    if (viewProviders) {
      args.push(viewProviders);
    }
    features.push(importExpr(Identifiers.ProvidersFeature).callFn(args));
  }
  for (const key of inputKeys) {
    if (meta.inputs[key].transformFunction !== null) {
      features.push(importExpr(Identifiers.InputTransformsFeatureFeature));
      break;
    }
  }
  if (meta.hostDirectives?.length) {
    features.push(importExpr(Identifiers.HostDirectivesFeature).callFn([createHostDirectivesFeatureArg(meta.hostDirectives)]));
  }
  if (meta.usesInheritance) {
    features.push(importExpr(Identifiers.InheritDefinitionFeature));
  }
  if (meta.fullInheritance) {
    features.push(importExpr(Identifiers.CopyDefinitionFeature));
  }
  if (meta.lifecycle.usesOnChanges) {
    features.push(importExpr(Identifiers.NgOnChangesFeature));
  }
  if ("externalStyles" in meta && meta.externalStyles?.length) {
    const externalStyleNodes = meta.externalStyles.map((externalStyle) => literal(externalStyle));
    features.push(importExpr(Identifiers.ExternalStylesFeature).callFn([literalArr(externalStyleNodes)]));
  }
  if (features.length) {
    definitionMap.set("features", literalArr(features));
  }
}
function compileDirectiveFromMetadata(meta, constantPool, bindingParser) {
  const definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
  addFeatures(definitionMap, meta);
  const expression = importExpr(Identifiers.defineDirective).callFn([definitionMap.toLiteralMap()], void 0, true);
  const type = createDirectiveType(meta);
  return { expression, type, statements: [] };
}
function compileComponentFromMetadata(meta, constantPool, bindingParser) {
  const definitionMap = baseDirectiveFields(meta, constantPool, bindingParser);
  addFeatures(definitionMap, meta);
  const selector = meta.selector && CssSelector.parse(meta.selector);
  const firstSelector = selector && selector[0];
  if (firstSelector) {
    const selectorAttributes = firstSelector.getAttrs();
    if (selectorAttributes.length) {
      definitionMap.set("attrs", constantPool.getConstLiteral(
        literalArr(selectorAttributes.map((value) => value != null ? literal(value) : literal(void 0))),
        /* forceShared */
        true
      ));
    }
  }
  const templateTypeName = meta.name;
  let allDeferrableDepsFn = null;
  if (meta.defer.mode === 1 && meta.defer.dependenciesFn !== null) {
    const fnName = `${templateTypeName}_DeferFn`;
    constantPool.statements.push(new DeclareVarStmt(fnName, meta.defer.dependenciesFn, void 0, StmtModifier.Final));
    allDeferrableDepsFn = variable(fnName);
  }
  const tpl = ingestComponent(meta.name, meta.template.nodes, constantPool, meta.relativeContextFilePath, meta.i18nUseExternalIds, meta.defer, allDeferrableDepsFn);
  transform(tpl, CompilationJobKind.Tmpl);
  const templateFn = emitTemplateFn(tpl, constantPool);
  if (tpl.contentSelectors !== null) {
    definitionMap.set("ngContentSelectors", tpl.contentSelectors);
  }
  definitionMap.set("decls", literal(tpl.root.decls));
  definitionMap.set("vars", literal(tpl.root.vars));
  if (tpl.consts.length > 0) {
    if (tpl.constsInitializers.length > 0) {
      definitionMap.set("consts", arrowFn([], [...tpl.constsInitializers, new ReturnStatement(literalArr(tpl.consts))]));
    } else {
      definitionMap.set("consts", literalArr(tpl.consts));
    }
  }
  definitionMap.set("template", templateFn);
  if (meta.declarationListEmitMode !== 3 && meta.declarations.length > 0) {
    definitionMap.set("dependencies", compileDeclarationList(literalArr(meta.declarations.map((decl) => decl.type)), meta.declarationListEmitMode));
  } else if (meta.declarationListEmitMode === 3) {
    const args = [meta.type.value];
    if (meta.rawImports) {
      args.push(meta.rawImports);
    }
    definitionMap.set("dependencies", importExpr(Identifiers.getComponentDepsFactory).callFn(args));
  }
  if (meta.encapsulation === null) {
    meta.encapsulation = ViewEncapsulation.Emulated;
  }
  let hasStyles = !!meta.externalStyles?.length;
  if (meta.styles && meta.styles.length) {
    const styleValues = meta.encapsulation == ViewEncapsulation.Emulated ? compileStyles(meta.styles, CONTENT_ATTR, HOST_ATTR) : meta.styles;
    const styleNodes = styleValues.reduce((result, style) => {
      if (style.trim().length > 0) {
        result.push(constantPool.getConstLiteral(literal(style)));
      }
      return result;
    }, []);
    if (styleNodes.length > 0) {
      hasStyles = true;
      definitionMap.set("styles", literalArr(styleNodes));
    }
  }
  if (!hasStyles && meta.encapsulation === ViewEncapsulation.Emulated) {
    meta.encapsulation = ViewEncapsulation.None;
  }
  if (meta.encapsulation !== ViewEncapsulation.Emulated) {
    definitionMap.set("encapsulation", literal(meta.encapsulation));
  }
  if (meta.animations !== null) {
    definitionMap.set("data", literalMap([{ key: "animation", value: meta.animations, quoted: false }]));
  }
  if (meta.changeDetection !== null) {
    if (typeof meta.changeDetection === "number" && meta.changeDetection !== ChangeDetectionStrategy.Default) {
      definitionMap.set("changeDetection", literal(meta.changeDetection));
    } else if (typeof meta.changeDetection === "object") {
      definitionMap.set("changeDetection", meta.changeDetection);
    }
  }
  const expression = importExpr(Identifiers.defineComponent).callFn([definitionMap.toLiteralMap()], void 0, true);
  const type = createComponentType(meta);
  return { expression, type, statements: [] };
}
function createComponentType(meta) {
  const typeParams = createBaseDirectiveTypeParams(meta);
  typeParams.push(stringArrayAsType(meta.template.ngContentSelectors));
  typeParams.push(expressionType(literal(meta.isStandalone)));
  typeParams.push(createHostDirectivesType(meta));
  if (meta.isSignal) {
    typeParams.push(expressionType(literal(meta.isSignal)));
  }
  return expressionType(importExpr(Identifiers.ComponentDeclaration, typeParams));
}
function compileDeclarationList(list, mode) {
  switch (mode) {
    case 0:
      return list;
    case 1:
      return arrowFn([], list);
    case 2:
      const resolvedList = list.prop("map").callFn([importExpr(Identifiers.resolveForwardRef)]);
      return arrowFn([], resolvedList);
    case 3:
      throw new Error(`Unsupported with an array of pre-resolved dependencies`);
  }
}
function stringAsType(str) {
  return expressionType(literal(str));
}
function stringMapAsLiteralExpression(map) {
  const mapValues = Object.keys(map).map((key) => {
    const value = Array.isArray(map[key]) ? map[key][0] : map[key];
    return {
      key,
      value: literal(value),
      quoted: true
    };
  });
  return literalMap(mapValues);
}
function stringArrayAsType(arr) {
  return arr.length > 0 ? expressionType(literalArr(arr.map((value) => literal(value)))) : NONE_TYPE;
}
function createBaseDirectiveTypeParams(meta) {
  const selectorForType = meta.selector !== null ? meta.selector.replace(/\n/g, "") : null;
  return [
    typeWithParameters(meta.type.type, meta.typeArgumentCount),
    selectorForType !== null ? stringAsType(selectorForType) : NONE_TYPE,
    meta.exportAs !== null ? stringArrayAsType(meta.exportAs) : NONE_TYPE,
    expressionType(getInputsTypeExpression(meta)),
    expressionType(stringMapAsLiteralExpression(meta.outputs)),
    stringArrayAsType(meta.queries.map((q) => q.propertyName))
  ];
}
function getInputsTypeExpression(meta) {
  return literalMap(Object.keys(meta.inputs).map((key) => {
    const value = meta.inputs[key];
    const values = [
      { key: "alias", value: literal(value.bindingPropertyName), quoted: true },
      { key: "required", value: literal(value.required), quoted: true }
    ];
    if (value.isSignal) {
      values.push({ key: "isSignal", value: literal(value.isSignal), quoted: true });
    }
    return { key, value: literalMap(values), quoted: true };
  }));
}
function createDirectiveType(meta) {
  const typeParams = createBaseDirectiveTypeParams(meta);
  typeParams.push(NONE_TYPE);
  typeParams.push(expressionType(literal(meta.isStandalone)));
  typeParams.push(createHostDirectivesType(meta));
  if (meta.isSignal) {
    typeParams.push(expressionType(literal(meta.isSignal)));
  }
  return expressionType(importExpr(Identifiers.DirectiveDeclaration, typeParams));
}
function createHostBindingsFunction(hostBindingsMetadata, typeSourceSpan, bindingParser, constantPool, selector, name, definitionMap) {
  const bindings = bindingParser.createBoundHostProperties(hostBindingsMetadata.properties, typeSourceSpan);
  const eventBindings = bindingParser.createDirectiveHostEventAsts(hostBindingsMetadata.listeners, typeSourceSpan);
  if (hostBindingsMetadata.specialAttributes.styleAttr) {
    hostBindingsMetadata.attributes["style"] = literal(hostBindingsMetadata.specialAttributes.styleAttr);
  }
  if (hostBindingsMetadata.specialAttributes.classAttr) {
    hostBindingsMetadata.attributes["class"] = literal(hostBindingsMetadata.specialAttributes.classAttr);
  }
  const hostJob = ingestHostBinding({
    componentName: name,
    componentSelector: selector,
    properties: bindings,
    events: eventBindings,
    attributes: hostBindingsMetadata.attributes
  }, bindingParser, constantPool);
  transform(hostJob, CompilationJobKind.Host);
  definitionMap.set("hostAttrs", hostJob.root.attributes);
  const varCount = hostJob.root.vars;
  if (varCount !== null && varCount > 0) {
    definitionMap.set("hostVars", literal(varCount));
  }
  return emitHostBindingFunction(hostJob);
}
const HOST_REG_EXP = /^(?:\[([^\]]+)\])|(?:\(([^\)]+)\))$/;
function parseHostBindings(host) {
  const attributes = {};
  const listeners = {};
  const properties = {};
  const specialAttributes = {};
  for (const key of Object.keys(host)) {
    const value = host[key];
    const matches = key.match(HOST_REG_EXP);
    if (matches === null) {
      switch (key) {
        case "class":
          if (typeof value !== "string") {
            throw new Error(`Class binding must be string`);
          }
          specialAttributes.classAttr = value;
          break;
        case "style":
          if (typeof value !== "string") {
            throw new Error(`Style binding must be string`);
          }
          specialAttributes.styleAttr = value;
          break;
        default:
          if (typeof value === "string") {
            attributes[key] = literal(value);
          } else {
            attributes[key] = value;
          }
      }
    } else if (matches[
      1
      /* HostBindingGroup.Binding */
    ] != null) {
      if (typeof value !== "string") {
        throw new Error(`Property binding must be string`);
      }
      properties[matches[
        1
        /* HostBindingGroup.Binding */
      ]] = value;
    } else if (matches[
      2
      /* HostBindingGroup.Event */
    ] != null) {
      if (typeof value !== "string") {
        throw new Error(`Event binding must be string`);
      }
      listeners[matches[
        2
        /* HostBindingGroup.Event */
      ]] = value;
    }
  }
  return { attributes, listeners, properties, specialAttributes };
}
function verifyHostBindings(bindings, sourceSpan) {
  const bindingParser = makeBindingParser();
  bindingParser.createDirectiveHostEventAsts(bindings.listeners, sourceSpan);
  bindingParser.createBoundHostProperties(bindings.properties, sourceSpan);
  return bindingParser.errors;
}
function compileStyles(styles, selector, hostSelector) {
  const shadowCss = new ShadowCss();
  return styles.map((style) => {
    return shadowCss.shimCssText(style, selector, hostSelector);
  });
}
function encapsulateStyle(style, componentIdentifier) {
  const shadowCss = new ShadowCss();
  const selector = componentIdentifier ? CONTENT_ATTR.replace(COMPONENT_VARIABLE, componentIdentifier) : CONTENT_ATTR;
  const hostSelector = componentIdentifier ? HOST_ATTR.replace(COMPONENT_VARIABLE, componentIdentifier) : HOST_ATTR;
  return shadowCss.shimCssText(style, selector, hostSelector);
}
function createHostDirectivesType(meta) {
  if (!meta.hostDirectives?.length) {
    return NONE_TYPE;
  }
  return expressionType(literalArr(meta.hostDirectives.map((hostMeta) => literalMap([
    { key: "directive", value: typeofExpr(hostMeta.directive.type), quoted: false },
    {
      key: "inputs",
      value: stringMapAsLiteralExpression(hostMeta.inputs || {}),
      quoted: false
    },
    {
      key: "outputs",
      value: stringMapAsLiteralExpression(hostMeta.outputs || {}),
      quoted: false
    }
  ]))));
}
function createHostDirectivesFeatureArg(hostDirectives) {
  const expressions = [];
  let hasForwardRef = false;
  for (const current of hostDirectives) {
    if (!current.inputs && !current.outputs) {
      expressions.push(current.directive.type);
    } else {
      const keys = [{ key: "directive", value: current.directive.type, quoted: false }];
      if (current.inputs) {
        const inputsLiteral = createHostDirectivesMappingArray(current.inputs);
        if (inputsLiteral) {
          keys.push({ key: "inputs", value: inputsLiteral, quoted: false });
        }
      }
      if (current.outputs) {
        const outputsLiteral = createHostDirectivesMappingArray(current.outputs);
        if (outputsLiteral) {
          keys.push({ key: "outputs", value: outputsLiteral, quoted: false });
        }
      }
      expressions.push(literalMap(keys));
    }
    if (current.isForwardReference) {
      hasForwardRef = true;
    }
  }
  return hasForwardRef ? new FunctionExpr([], [new ReturnStatement(literalArr(expressions))]) : literalArr(expressions);
}
function createHostDirectivesMappingArray(mapping) {
  const elements = [];
  for (const publicName in mapping) {
    if (mapping.hasOwnProperty(publicName)) {
      elements.push(literal(publicName), literal(mapping[publicName]));
    }
  }
  return elements.length > 0 ? literalArr(elements) : null;
}
function compileDeferResolverFunction(meta) {
  const depExpressions = [];
  if (meta.mode === 0) {
    for (const dep of meta.dependencies) {
      if (dep.isDeferrable) {
        const innerFn = arrowFn(
          // Default imports are always accessed through the `default` property.
          [new FnParam("m", DYNAMIC_TYPE)],
          variable("m").prop(dep.isDefaultImport ? "default" : dep.symbolName)
        );
        const importExpr2 = new DynamicImportExpr(dep.importPath).prop("then").callFn([innerFn]);
        depExpressions.push(importExpr2);
      } else {
        depExpressions.push(dep.typeReference);
      }
    }
  } else {
    for (const { symbolName, importPath, isDefaultImport } of meta.dependencies) {
      const innerFn = arrowFn([new FnParam("m", DYNAMIC_TYPE)], variable("m").prop(isDefaultImport ? "default" : symbolName));
      const importExpr2 = new DynamicImportExpr(importPath).prop("then").callFn([innerFn]);
      depExpressions.push(importExpr2);
    }
  }
  return arrowFn([], literalArr(depExpressions));
}
function diff(fullList, itemsToExclude) {
  const exclude = new Set(itemsToExclude);
  return fullList.filter((item) => !exclude.has(item));
}
function findMatchingDirectivesAndPipes(template2, directiveSelectors) {
  const matcher = new SelectorMatcher();
  for (const selector of directiveSelectors) {
    const fakeDirective = {
      selector,
      exportAs: null,
      inputs: {
        hasBindingPropertyName() {
          return false;
        }
      },
      outputs: {
        hasBindingPropertyName() {
          return false;
        }
      }
    };
    matcher.addSelectables(CssSelector.parse(selector), [fakeDirective]);
  }
  const parsedTemplate = parseTemplate(
    template2,
    ""
    /* templateUrl */
  );
  const binder = new R3TargetBinder(matcher);
  const bound = binder.bind({ template: parsedTemplate.nodes });
  const eagerDirectiveSelectors = bound.getEagerlyUsedDirectives().map((dir) => dir.selector);
  const allMatchedDirectiveSelectors = bound.getUsedDirectives().map((dir) => dir.selector);
  const eagerPipes = bound.getEagerlyUsedPipes();
  return {
    directives: {
      regular: eagerDirectiveSelectors,
      deferCandidates: diff(allMatchedDirectiveSelectors, eagerDirectiveSelectors)
    },
    pipes: {
      regular: eagerPipes,
      deferCandidates: diff(bound.getUsedPipes(), eagerPipes)
    }
  };
}
class R3TargetBinder {
  directiveMatcher;
  constructor(directiveMatcher) {
    this.directiveMatcher = directiveMatcher;
  }
  /**
   * Perform a binding operation on the given `Target` and return a `BoundTarget` which contains
   * metadata about the types referenced in the template.
   */
  bind(target) {
    if (!target.template) {
      throw new Error("Binding without a template not yet supported");
    }
    const scope = Scope.apply(target.template);
    const scopedNodeEntities = extractScopedNodeEntities(scope);
    const { directives, eagerDirectives, bindings, references } = DirectiveBinder.apply(target.template, this.directiveMatcher);
    const { expressions, symbols, nestingLevel, usedPipes, eagerPipes, deferBlocks } = TemplateBinder.applyWithScope(target.template, scope);
    return new R3BoundTarget(target, directives, eagerDirectives, bindings, references, expressions, symbols, nestingLevel, scopedNodeEntities, usedPipes, eagerPipes, deferBlocks);
  }
}
class Scope {
  parentScope;
  rootNode;
  /**
   * Named members of the `Scope`, such as `Reference`s or `Variable`s.
   */
  namedEntities = /* @__PURE__ */ new Map();
  /**
   * Set of elements that belong to this scope.
   */
  elementsInScope = /* @__PURE__ */ new Set();
  /**
   * Child `Scope`s for immediately nested `ScopedNode`s.
   */
  childScopes = /* @__PURE__ */ new Map();
  /** Whether this scope is deferred or if any of its ancestors are deferred. */
  isDeferred;
  constructor(parentScope, rootNode) {
    this.parentScope = parentScope;
    this.rootNode = rootNode;
    this.isDeferred = parentScope !== null && parentScope.isDeferred ? true : rootNode instanceof DeferredBlock;
  }
  static newRootScope() {
    return new Scope(null, null);
  }
  /**
   * Process a template (either as a `Template` sub-template with variables, or a plain array of
   * template `Node`s) and construct its `Scope`.
   */
  static apply(template2) {
    const scope = Scope.newRootScope();
    scope.ingest(template2);
    return scope;
  }
  /**
   * Internal method to process the scoped node and populate the `Scope`.
   */
  ingest(nodeOrNodes) {
    if (nodeOrNodes instanceof Template) {
      nodeOrNodes.variables.forEach((node) => this.visitVariable(node));
      nodeOrNodes.children.forEach((node) => node.visit(this));
    } else if (nodeOrNodes instanceof IfBlockBranch) {
      if (nodeOrNodes.expressionAlias !== null) {
        this.visitVariable(nodeOrNodes.expressionAlias);
      }
      nodeOrNodes.children.forEach((node) => node.visit(this));
    } else if (nodeOrNodes instanceof ForLoopBlock) {
      this.visitVariable(nodeOrNodes.item);
      nodeOrNodes.contextVariables.forEach((v) => this.visitVariable(v));
      nodeOrNodes.children.forEach((node) => node.visit(this));
    } else if (nodeOrNodes instanceof SwitchBlockCase || nodeOrNodes instanceof ForLoopBlockEmpty || nodeOrNodes instanceof DeferredBlock || nodeOrNodes instanceof DeferredBlockError || nodeOrNodes instanceof DeferredBlockPlaceholder || nodeOrNodes instanceof DeferredBlockLoading || nodeOrNodes instanceof Content) {
      nodeOrNodes.children.forEach((node) => node.visit(this));
    } else {
      nodeOrNodes.forEach((node) => node.visit(this));
    }
  }
  visitElement(element2) {
    element2.references.forEach((node) => this.visitReference(node));
    element2.children.forEach((node) => node.visit(this));
    this.elementsInScope.add(element2);
  }
  visitTemplate(template2) {
    template2.references.forEach((node) => this.visitReference(node));
    this.ingestScopedNode(template2);
  }
  visitVariable(variable2) {
    this.maybeDeclare(variable2);
  }
  visitReference(reference2) {
    this.maybeDeclare(reference2);
  }
  visitDeferredBlock(deferred) {
    this.ingestScopedNode(deferred);
    deferred.placeholder?.visit(this);
    deferred.loading?.visit(this);
    deferred.error?.visit(this);
  }
  visitDeferredBlockPlaceholder(block) {
    this.ingestScopedNode(block);
  }
  visitDeferredBlockError(block) {
    this.ingestScopedNode(block);
  }
  visitDeferredBlockLoading(block) {
    this.ingestScopedNode(block);
  }
  visitSwitchBlock(block) {
    block.cases.forEach((node) => node.visit(this));
  }
  visitSwitchBlockCase(block) {
    this.ingestScopedNode(block);
  }
  visitForLoopBlock(block) {
    this.ingestScopedNode(block);
    block.empty?.visit(this);
  }
  visitForLoopBlockEmpty(block) {
    this.ingestScopedNode(block);
  }
  visitIfBlock(block) {
    block.branches.forEach((node) => node.visit(this));
  }
  visitIfBlockBranch(block) {
    this.ingestScopedNode(block);
  }
  visitContent(content) {
    this.ingestScopedNode(content);
  }
  visitLetDeclaration(decl) {
    this.maybeDeclare(decl);
  }
  // Unused visitors.
  visitBoundAttribute(attr) {
  }
  visitBoundEvent(event) {
  }
  visitBoundText(text2) {
  }
  visitText(text2) {
  }
  visitTextAttribute(attr) {
  }
  visitIcu(icu) {
  }
  visitDeferredTrigger(trigger) {
  }
  visitUnknownBlock(block) {
  }
  maybeDeclare(thing) {
    if (!this.namedEntities.has(thing.name)) {
      this.namedEntities.set(thing.name, thing);
    }
  }
  /**
   * Look up a variable within this `Scope`.
   *
   * This can recurse into a parent `Scope` if it's available.
   */
  lookup(name) {
    if (this.namedEntities.has(name)) {
      return this.namedEntities.get(name);
    } else if (this.parentScope !== null) {
      return this.parentScope.lookup(name);
    } else {
      return null;
    }
  }
  /**
   * Get the child scope for a `ScopedNode`.
   *
   * This should always be defined.
   */
  getChildScope(node) {
    const res = this.childScopes.get(node);
    if (res === void 0) {
      throw new Error(`Assertion error: child scope for ${node} not found`);
    }
    return res;
  }
  ingestScopedNode(node) {
    const scope = new Scope(this, node);
    scope.ingest(node);
    this.childScopes.set(node, scope);
  }
}
class DirectiveBinder {
  matcher;
  directives;
  eagerDirectives;
  bindings;
  references;
  // Indicates whether we are visiting elements within a `defer` block
  isInDeferBlock = false;
  constructor(matcher, directives, eagerDirectives, bindings, references) {
    this.matcher = matcher;
    this.directives = directives;
    this.eagerDirectives = eagerDirectives;
    this.bindings = bindings;
    this.references = references;
  }
  /**
   * Process a template (list of `Node`s) and perform directive matching against each node.
   *
   * @param template the list of template `Node`s to match (recursively).
   * @param selectorMatcher a `SelectorMatcher` containing the directives that are in scope for
   * this template.
   * @returns three maps which contain information about directives in the template: the
   * `directives` map which lists directives matched on each node, the `bindings` map which
   * indicates which directives claimed which bindings (inputs, outputs, etc), and the `references`
   * map which resolves #references (`Reference`s) within the template to the named directive or
   * template node.
   */
  static apply(template2, selectorMatcher) {
    const directives = /* @__PURE__ */ new Map();
    const bindings = /* @__PURE__ */ new Map();
    const references = /* @__PURE__ */ new Map();
    const eagerDirectives = [];
    const matcher = new DirectiveBinder(selectorMatcher, directives, eagerDirectives, bindings, references);
    matcher.ingest(template2);
    return { directives, eagerDirectives, bindings, references };
  }
  ingest(template2) {
    template2.forEach((node) => node.visit(this));
  }
  visitElement(element2) {
    this.visitElementOrTemplate(element2);
  }
  visitTemplate(template2) {
    this.visitElementOrTemplate(template2);
  }
  visitElementOrTemplate(node) {
    const cssSelector = createCssSelectorFromNode(node);
    const directives = [];
    this.matcher.match(cssSelector, (_selector, results) => directives.push(...results));
    if (directives.length > 0) {
      this.directives.set(node, directives);
      if (!this.isInDeferBlock) {
        this.eagerDirectives.push(...directives);
      }
    }
    node.references.forEach((ref) => {
      let dirTarget = null;
      if (ref.value.trim() === "") {
        dirTarget = directives.find((dir) => dir.isComponent) || null;
      } else {
        dirTarget = directives.find((dir) => dir.exportAs !== null && dir.exportAs.some((value) => value === ref.value)) || null;
        if (dirTarget === null) {
          return;
        }
      }
      if (dirTarget !== null) {
        this.references.set(ref, { directive: dirTarget, node });
      } else {
        this.references.set(ref, node);
      }
    });
    const setAttributeBinding = (attribute2, ioType) => {
      const dir = directives.find((dir2) => dir2[ioType].hasBindingPropertyName(attribute2.name));
      const binding = dir !== void 0 ? dir : node;
      this.bindings.set(attribute2, binding);
    };
    node.inputs.forEach((input) => setAttributeBinding(input, "inputs"));
    node.attributes.forEach((attr) => setAttributeBinding(attr, "inputs"));
    if (node instanceof Template) {
      node.templateAttrs.forEach((attr) => setAttributeBinding(attr, "inputs"));
    }
    node.outputs.forEach((output) => setAttributeBinding(output, "outputs"));
    node.children.forEach((child) => child.visit(this));
  }
  visitDeferredBlock(deferred) {
    const wasInDeferBlock = this.isInDeferBlock;
    this.isInDeferBlock = true;
    deferred.children.forEach((child) => child.visit(this));
    this.isInDeferBlock = wasInDeferBlock;
    deferred.placeholder?.visit(this);
    deferred.loading?.visit(this);
    deferred.error?.visit(this);
  }
  visitDeferredBlockPlaceholder(block) {
    block.children.forEach((child) => child.visit(this));
  }
  visitDeferredBlockError(block) {
    block.children.forEach((child) => child.visit(this));
  }
  visitDeferredBlockLoading(block) {
    block.children.forEach((child) => child.visit(this));
  }
  visitSwitchBlock(block) {
    block.cases.forEach((node) => node.visit(this));
  }
  visitSwitchBlockCase(block) {
    block.children.forEach((node) => node.visit(this));
  }
  visitForLoopBlock(block) {
    block.item.visit(this);
    block.contextVariables.forEach((v) => v.visit(this));
    block.children.forEach((node) => node.visit(this));
    block.empty?.visit(this);
  }
  visitForLoopBlockEmpty(block) {
    block.children.forEach((node) => node.visit(this));
  }
  visitIfBlock(block) {
    block.branches.forEach((node) => node.visit(this));
  }
  visitIfBlockBranch(block) {
    block.expressionAlias?.visit(this);
    block.children.forEach((node) => node.visit(this));
  }
  visitContent(content) {
    content.children.forEach((child) => child.visit(this));
  }
  // Unused visitors.
  visitVariable(variable2) {
  }
  visitReference(reference2) {
  }
  visitTextAttribute(attribute2) {
  }
  visitBoundAttribute(attribute2) {
  }
  visitBoundEvent(attribute2) {
  }
  visitBoundAttributeOrEvent(node) {
  }
  visitText(text2) {
  }
  visitBoundText(text2) {
  }
  visitIcu(icu) {
  }
  visitDeferredTrigger(trigger) {
  }
  visitUnknownBlock(block) {
  }
  visitLetDeclaration(decl) {
  }
}
class TemplateBinder extends RecursiveAstVisitor {
  bindings;
  symbols;
  usedPipes;
  eagerPipes;
  deferBlocks;
  nestingLevel;
  scope;
  rootNode;
  level;
  visitNode;
  constructor(bindings, symbols, usedPipes, eagerPipes, deferBlocks, nestingLevel, scope, rootNode, level) {
    super();
    this.bindings = bindings;
    this.symbols = symbols;
    this.usedPipes = usedPipes;
    this.eagerPipes = eagerPipes;
    this.deferBlocks = deferBlocks;
    this.nestingLevel = nestingLevel;
    this.scope = scope;
    this.rootNode = rootNode;
    this.level = level;
    this.visitNode = (node) => node.visit(this);
  }
  // This method is defined to reconcile the type of TemplateBinder since both
  // RecursiveAstVisitor and Visitor define the visit() method in their
  // interfaces.
  visit(node, context) {
    if (node instanceof AST) {
      node.visit(this, context);
    } else {
      node.visit(this);
    }
  }
  /**
   * Process a template and extract metadata about expressions and symbols within.
   *
   * @param nodes the nodes of the template to process
   * @param scope the `Scope` of the template being processed.
   * @returns three maps which contain metadata about the template: `expressions` which interprets
   * special `AST` nodes in expressions as pointing to references or variables declared within the
   * template, `symbols` which maps those variables and references to the nested `Template` which
   * declares them, if any, and `nestingLevel` which associates each `Template` with a integer
   * nesting level (how many levels deep within the template structure the `Template` is), starting
   * at 1.
   */
  static applyWithScope(nodes, scope) {
    const expressions = /* @__PURE__ */ new Map();
    const symbols = /* @__PURE__ */ new Map();
    const nestingLevel = /* @__PURE__ */ new Map();
    const usedPipes = /* @__PURE__ */ new Set();
    const eagerPipes = /* @__PURE__ */ new Set();
    const template2 = nodes instanceof Template ? nodes : null;
    const deferBlocks = [];
    const binder = new TemplateBinder(expressions, symbols, usedPipes, eagerPipes, deferBlocks, nestingLevel, scope, template2, 0);
    binder.ingest(nodes);
    return { expressions, symbols, nestingLevel, usedPipes, eagerPipes, deferBlocks };
  }
  ingest(nodeOrNodes) {
    if (nodeOrNodes instanceof Template) {
      nodeOrNodes.variables.forEach(this.visitNode);
      nodeOrNodes.children.forEach(this.visitNode);
      this.nestingLevel.set(nodeOrNodes, this.level);
    } else if (nodeOrNodes instanceof IfBlockBranch) {
      if (nodeOrNodes.expressionAlias !== null) {
        this.visitNode(nodeOrNodes.expressionAlias);
      }
      nodeOrNodes.children.forEach(this.visitNode);
      this.nestingLevel.set(nodeOrNodes, this.level);
    } else if (nodeOrNodes instanceof ForLoopBlock) {
      this.visitNode(nodeOrNodes.item);
      nodeOrNodes.contextVariables.forEach((v) => this.visitNode(v));
      nodeOrNodes.trackBy.visit(this);
      nodeOrNodes.children.forEach(this.visitNode);
      this.nestingLevel.set(nodeOrNodes, this.level);
    } else if (nodeOrNodes instanceof DeferredBlock) {
      if (this.scope.rootNode !== nodeOrNodes) {
        throw new Error(`Assertion error: resolved incorrect scope for deferred block ${nodeOrNodes}`);
      }
      this.deferBlocks.push([nodeOrNodes, this.scope]);
      nodeOrNodes.children.forEach((node) => node.visit(this));
      this.nestingLevel.set(nodeOrNodes, this.level);
    } else if (nodeOrNodes instanceof SwitchBlockCase || nodeOrNodes instanceof ForLoopBlockEmpty || nodeOrNodes instanceof DeferredBlockError || nodeOrNodes instanceof DeferredBlockPlaceholder || nodeOrNodes instanceof DeferredBlockLoading || nodeOrNodes instanceof Content) {
      nodeOrNodes.children.forEach((node) => node.visit(this));
      this.nestingLevel.set(nodeOrNodes, this.level);
    } else {
      nodeOrNodes.forEach(this.visitNode);
    }
  }
  visitElement(element2) {
    element2.inputs.forEach(this.visitNode);
    element2.outputs.forEach(this.visitNode);
    element2.children.forEach(this.visitNode);
    element2.references.forEach(this.visitNode);
  }
  visitTemplate(template2) {
    template2.inputs.forEach(this.visitNode);
    template2.outputs.forEach(this.visitNode);
    template2.templateAttrs.forEach(this.visitNode);
    template2.references.forEach(this.visitNode);
    this.ingestScopedNode(template2);
  }
  visitVariable(variable2) {
    if (this.rootNode !== null) {
      this.symbols.set(variable2, this.rootNode);
    }
  }
  visitReference(reference2) {
    if (this.rootNode !== null) {
      this.symbols.set(reference2, this.rootNode);
    }
  }
  // Unused template visitors
  visitText(text2) {
  }
  visitTextAttribute(attribute2) {
  }
  visitUnknownBlock(block) {
  }
  visitDeferredTrigger() {
  }
  visitIcu(icu) {
    Object.keys(icu.vars).forEach((key) => icu.vars[key].visit(this));
    Object.keys(icu.placeholders).forEach((key) => icu.placeholders[key].visit(this));
  }
  // The remaining visitors are concerned with processing AST expressions within template bindings
  visitBoundAttribute(attribute2) {
    attribute2.value.visit(this);
  }
  visitBoundEvent(event) {
    event.handler.visit(this);
  }
  visitDeferredBlock(deferred) {
    this.ingestScopedNode(deferred);
    deferred.triggers.when?.value.visit(this);
    deferred.prefetchTriggers.when?.value.visit(this);
    deferred.hydrateTriggers.when?.value.visit(this);
    deferred.hydrateTriggers.never?.visit(this);
    deferred.placeholder && this.visitNode(deferred.placeholder);
    deferred.loading && this.visitNode(deferred.loading);
    deferred.error && this.visitNode(deferred.error);
  }
  visitDeferredBlockPlaceholder(block) {
    this.ingestScopedNode(block);
  }
  visitDeferredBlockError(block) {
    this.ingestScopedNode(block);
  }
  visitDeferredBlockLoading(block) {
    this.ingestScopedNode(block);
  }
  visitSwitchBlock(block) {
    block.expression.visit(this);
    block.cases.forEach(this.visitNode);
  }
  visitSwitchBlockCase(block) {
    block.expression?.visit(this);
    this.ingestScopedNode(block);
  }
  visitForLoopBlock(block) {
    block.expression.visit(this);
    this.ingestScopedNode(block);
    block.empty?.visit(this);
  }
  visitForLoopBlockEmpty(block) {
    this.ingestScopedNode(block);
  }
  visitIfBlock(block) {
    block.branches.forEach((node) => node.visit(this));
  }
  visitIfBlockBranch(block) {
    block.expression?.visit(this);
    this.ingestScopedNode(block);
  }
  visitContent(content) {
    this.ingestScopedNode(content);
  }
  visitBoundText(text2) {
    text2.value.visit(this);
  }
  visitLetDeclaration(decl) {
    decl.value.visit(this);
    if (this.rootNode !== null) {
      this.symbols.set(decl, this.rootNode);
    }
  }
  visitPipe(ast, context) {
    this.usedPipes.add(ast.name);
    if (!this.scope.isDeferred) {
      this.eagerPipes.add(ast.name);
    }
    return super.visitPipe(ast, context);
  }
  // These five types of AST expressions can refer to expression roots, which could be variables
  // or references in the current scope.
  visitPropertyRead(ast, context) {
    this.maybeMap(ast, ast.name);
    return super.visitPropertyRead(ast, context);
  }
  visitSafePropertyRead(ast, context) {
    this.maybeMap(ast, ast.name);
    return super.visitSafePropertyRead(ast, context);
  }
  visitPropertyWrite(ast, context) {
    this.maybeMap(ast, ast.name);
    return super.visitPropertyWrite(ast, context);
  }
  ingestScopedNode(node) {
    const childScope = this.scope.getChildScope(node);
    const binder = new TemplateBinder(this.bindings, this.symbols, this.usedPipes, this.eagerPipes, this.deferBlocks, this.nestingLevel, childScope, node, this.level + 1);
    binder.ingest(node);
  }
  maybeMap(ast, name) {
    if (!(ast.receiver instanceof ImplicitReceiver) || ast.receiver instanceof ThisReceiver) {
      return;
    }
    const target = this.scope.lookup(name);
    if (target !== null) {
      this.bindings.set(ast, target);
    }
  }
}
class R3BoundTarget {
  target;
  directives;
  eagerDirectives;
  bindings;
  references;
  exprTargets;
  symbols;
  nestingLevel;
  scopedNodeEntities;
  usedPipes;
  eagerPipes;
  /** Deferred blocks, ordered as they appear in the template. */
  deferredBlocks;
  /** Map of deferred blocks to their scope. */
  deferredScopes;
  constructor(target, directives, eagerDirectives, bindings, references, exprTargets, symbols, nestingLevel, scopedNodeEntities, usedPipes, eagerPipes, rawDeferred) {
    this.target = target;
    this.directives = directives;
    this.eagerDirectives = eagerDirectives;
    this.bindings = bindings;
    this.references = references;
    this.exprTargets = exprTargets;
    this.symbols = symbols;
    this.nestingLevel = nestingLevel;
    this.scopedNodeEntities = scopedNodeEntities;
    this.usedPipes = usedPipes;
    this.eagerPipes = eagerPipes;
    this.deferredBlocks = rawDeferred.map((current) => current[0]);
    this.deferredScopes = new Map(rawDeferred);
  }
  getEntitiesInScope(node) {
    return this.scopedNodeEntities.get(node) ?? /* @__PURE__ */ new Set();
  }
  getDirectivesOfNode(node) {
    return this.directives.get(node) || null;
  }
  getReferenceTarget(ref) {
    return this.references.get(ref) || null;
  }
  getConsumerOfBinding(binding) {
    return this.bindings.get(binding) || null;
  }
  getExpressionTarget(expr) {
    return this.exprTargets.get(expr) || null;
  }
  getDefinitionNodeOfSymbol(symbol) {
    return this.symbols.get(symbol) || null;
  }
  getNestingLevel(node) {
    return this.nestingLevel.get(node) || 0;
  }
  getUsedDirectives() {
    const set = /* @__PURE__ */ new Set();
    this.directives.forEach((dirs) => dirs.forEach((dir) => set.add(dir)));
    return Array.from(set.values());
  }
  getEagerlyUsedDirectives() {
    const set = new Set(this.eagerDirectives);
    return Array.from(set.values());
  }
  getUsedPipes() {
    return Array.from(this.usedPipes);
  }
  getEagerlyUsedPipes() {
    return Array.from(this.eagerPipes);
  }
  getDeferBlocks() {
    return this.deferredBlocks;
  }
  getDeferredTriggerTarget(block, trigger) {
    if (!(trigger instanceof InteractionDeferredTrigger) && !(trigger instanceof ViewportDeferredTrigger) && !(trigger instanceof HoverDeferredTrigger)) {
      return null;
    }
    const name = trigger.reference;
    if (name === null) {
      let trigger2 = null;
      if (block.placeholder !== null) {
        for (const child of block.placeholder.children) {
          if (child instanceof Comment$1) {
            continue;
          }
          if (trigger2 !== null) {
            return null;
          }
          if (child instanceof Element$1) {
            trigger2 = child;
          }
        }
      }
      return trigger2;
    }
    const outsideRef = this.findEntityInScope(block, name);
    if (outsideRef instanceof Reference && this.getDefinitionNodeOfSymbol(outsideRef) !== block) {
      const target = this.getReferenceTarget(outsideRef);
      if (target !== null) {
        return this.referenceTargetToElement(target);
      }
    }
    if (block.placeholder !== null) {
      const refInPlaceholder = this.findEntityInScope(block.placeholder, name);
      const targetInPlaceholder = refInPlaceholder instanceof Reference ? this.getReferenceTarget(refInPlaceholder) : null;
      if (targetInPlaceholder !== null) {
        return this.referenceTargetToElement(targetInPlaceholder);
      }
    }
    return null;
  }
  isDeferred(element2) {
    for (const block of this.deferredBlocks) {
      if (!this.deferredScopes.has(block)) {
        continue;
      }
      const stack = [this.deferredScopes.get(block)];
      while (stack.length > 0) {
        const current = stack.pop();
        if (current.elementsInScope.has(element2)) {
          return true;
        }
        stack.push(...current.childScopes.values());
      }
    }
    return false;
  }
  /**
   * Finds an entity with a specific name in a scope.
   * @param rootNode Root node of the scope.
   * @param name Name of the entity.
   */
  findEntityInScope(rootNode, name) {
    const entities = this.getEntitiesInScope(rootNode);
    for (const entity of entities) {
      if (entity.name === name) {
        return entity;
      }
    }
    return null;
  }
  /** Coerces a `ReferenceTarget` to an `Element`, if possible. */
  referenceTargetToElement(target) {
    if (target instanceof Element$1) {
      return target;
    }
    if (target instanceof Template) {
      return null;
    }
    return this.referenceTargetToElement(target.node);
  }
}
function extractScopedNodeEntities(rootScope) {
  const entityMap = /* @__PURE__ */ new Map();
  function extractScopeEntities(scope) {
    if (entityMap.has(scope.rootNode)) {
      return entityMap.get(scope.rootNode);
    }
    const currentEntities = scope.namedEntities;
    let entities;
    if (scope.parentScope !== null) {
      entities = new Map([...extractScopeEntities(scope.parentScope), ...currentEntities]);
    } else {
      entities = new Map(currentEntities);
    }
    entityMap.set(scope.rootNode, entities);
    return entities;
  }
  const scopesToProcess = [rootScope];
  while (scopesToProcess.length > 0) {
    const scope = scopesToProcess.pop();
    for (const childScope of scope.childScopes.values()) {
      scopesToProcess.push(childScope);
    }
    extractScopeEntities(scope);
  }
  const templateEntities = /* @__PURE__ */ new Map();
  for (const [template2, entities] of entityMap) {
    templateEntities.set(template2, new Set(entities.values()));
  }
  return templateEntities;
}
class ResourceLoader {
}
class CompilerFacadeImpl {
  jitEvaluator;
  FactoryTarget = FactoryTarget$1;
  ResourceLoader = ResourceLoader;
  elementSchemaRegistry = new DomElementSchemaRegistry();
  constructor(jitEvaluator = new JitEvaluator()) {
    this.jitEvaluator = jitEvaluator;
  }
  compilePipe(angularCoreEnv, sourceMapUrl, facade) {
    const metadata = {
      name: facade.name,
      type: wrapReference(facade.type),
      typeArgumentCount: 0,
      deps: null,
      pipeName: facade.pipeName,
      pure: facade.pure,
      isStandalone: facade.isStandalone
    };
    const res = compilePipeFromMetadata(metadata);
    return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
  }
  compilePipeDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
    const meta = convertDeclarePipeFacadeToMetadata(declaration);
    const res = compilePipeFromMetadata(meta);
    return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
  }
  compileInjectable(angularCoreEnv, sourceMapUrl, facade) {
    const { expression, statements } = compileInjectable(
      {
        name: facade.name,
        type: wrapReference(facade.type),
        typeArgumentCount: facade.typeArgumentCount,
        providedIn: computeProvidedIn(facade.providedIn),
        useClass: convertToProviderExpression(facade, "useClass"),
        useFactory: wrapExpression(facade, "useFactory"),
        useValue: convertToProviderExpression(facade, "useValue"),
        useExisting: convertToProviderExpression(facade, "useExisting"),
        deps: facade.deps?.map(convertR3DependencyMetadata)
      },
      /* resolveForwardRefs */
      true
    );
    return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
  }
  compileInjectableDeclaration(angularCoreEnv, sourceMapUrl, facade) {
    const { expression, statements } = compileInjectable(
      {
        name: facade.type.name,
        type: wrapReference(facade.type),
        typeArgumentCount: 0,
        providedIn: computeProvidedIn(facade.providedIn),
        useClass: convertToProviderExpression(facade, "useClass"),
        useFactory: wrapExpression(facade, "useFactory"),
        useValue: convertToProviderExpression(facade, "useValue"),
        useExisting: convertToProviderExpression(facade, "useExisting"),
        deps: facade.deps?.map(convertR3DeclareDependencyMetadata)
      },
      /* resolveForwardRefs */
      true
    );
    return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, statements);
  }
  compileInjector(angularCoreEnv, sourceMapUrl, facade) {
    const meta = {
      name: facade.name,
      type: wrapReference(facade.type),
      providers: facade.providers && facade.providers.length > 0 ? new WrappedNodeExpr(facade.providers) : null,
      imports: facade.imports.map((i) => new WrappedNodeExpr(i))
    };
    const res = compileInjector(meta);
    return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
  }
  compileInjectorDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
    const meta = convertDeclareInjectorFacadeToMetadata(declaration);
    const res = compileInjector(meta);
    return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
  }
  compileNgModule(angularCoreEnv, sourceMapUrl, facade) {
    const meta = {
      kind: R3NgModuleMetadataKind.Global,
      type: wrapReference(facade.type),
      bootstrap: facade.bootstrap.map(wrapReference),
      declarations: facade.declarations.map(wrapReference),
      publicDeclarationTypes: null,
      // only needed for types in AOT
      imports: facade.imports.map(wrapReference),
      includeImportTypes: true,
      exports: facade.exports.map(wrapReference),
      selectorScopeMode: R3SelectorScopeMode.Inline,
      containsForwardDecls: false,
      schemas: facade.schemas ? facade.schemas.map(wrapReference) : null,
      id: facade.id ? new WrappedNodeExpr(facade.id) : null
    };
    const res = compileNgModule(meta);
    return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, []);
  }
  compileNgModuleDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
    const expression = compileNgModuleDeclarationExpression(declaration);
    return this.jitExpression(expression, angularCoreEnv, sourceMapUrl, []);
  }
  compileDirective(angularCoreEnv, sourceMapUrl, facade) {
    const meta = convertDirectiveFacadeToMetadata(facade);
    return this.compileDirectiveFromMeta(angularCoreEnv, sourceMapUrl, meta);
  }
  compileDirectiveDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
    const typeSourceSpan = this.createParseSourceSpan("Directive", declaration.type.name, sourceMapUrl);
    const meta = convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan);
    return this.compileDirectiveFromMeta(angularCoreEnv, sourceMapUrl, meta);
  }
  compileDirectiveFromMeta(angularCoreEnv, sourceMapUrl, meta) {
    const constantPool = new ConstantPool();
    const bindingParser = makeBindingParser();
    const res = compileDirectiveFromMetadata(meta, constantPool, bindingParser);
    return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
  }
  compileComponent(angularCoreEnv, sourceMapUrl, facade) {
    const { template: template2, interpolation, defer: defer2 } = parseJitTemplate(facade.template, facade.name, sourceMapUrl, facade.preserveWhitespaces, facade.interpolation, void 0);
    const meta = {
      ...facade,
      ...convertDirectiveFacadeToMetadata(facade),
      selector: facade.selector || this.elementSchemaRegistry.getDefaultComponentElementName(),
      template: template2,
      declarations: facade.declarations.map(convertDeclarationFacadeToMetadata),
      declarationListEmitMode: 0,
      defer: defer2,
      styles: [...facade.styles, ...template2.styles],
      encapsulation: facade.encapsulation,
      interpolation,
      changeDetection: facade.changeDetection ?? null,
      animations: facade.animations != null ? new WrappedNodeExpr(facade.animations) : null,
      viewProviders: facade.viewProviders != null ? new WrappedNodeExpr(facade.viewProviders) : null,
      relativeContextFilePath: "",
      i18nUseExternalIds: true
    };
    const jitExpressionSourceMap = `ng:///${facade.name}.js`;
    return this.compileComponentFromMeta(angularCoreEnv, jitExpressionSourceMap, meta);
  }
  compileComponentDeclaration(angularCoreEnv, sourceMapUrl, declaration) {
    const typeSourceSpan = this.createParseSourceSpan("Component", declaration.type.name, sourceMapUrl);
    const meta = convertDeclareComponentFacadeToMetadata(declaration, typeSourceSpan, sourceMapUrl);
    return this.compileComponentFromMeta(angularCoreEnv, sourceMapUrl, meta);
  }
  compileComponentFromMeta(angularCoreEnv, sourceMapUrl, meta) {
    const constantPool = new ConstantPool();
    const bindingParser = makeBindingParser(meta.interpolation);
    const res = compileComponentFromMetadata(meta, constantPool, bindingParser);
    return this.jitExpression(res.expression, angularCoreEnv, sourceMapUrl, constantPool.statements);
  }
  compileFactory(angularCoreEnv, sourceMapUrl, meta) {
    const factoryRes = compileFactoryFunction({
      name: meta.name,
      type: wrapReference(meta.type),
      typeArgumentCount: meta.typeArgumentCount,
      deps: convertR3DependencyMetadataArray(meta.deps),
      target: meta.target
    });
    return this.jitExpression(factoryRes.expression, angularCoreEnv, sourceMapUrl, factoryRes.statements);
  }
  compileFactoryDeclaration(angularCoreEnv, sourceMapUrl, meta) {
    const factoryRes = compileFactoryFunction({
      name: meta.type.name,
      type: wrapReference(meta.type),
      typeArgumentCount: 0,
      deps: Array.isArray(meta.deps) ? meta.deps.map(convertR3DeclareDependencyMetadata) : meta.deps,
      target: meta.target
    });
    return this.jitExpression(factoryRes.expression, angularCoreEnv, sourceMapUrl, factoryRes.statements);
  }
  createParseSourceSpan(kind, typeName, sourceUrl) {
    return r3JitTypeSourceSpan(kind, typeName, sourceUrl);
  }
  /**
   * JIT compiles an expression and returns the result of executing that expression.
   *
   * @param def the definition which will be compiled and executed to get the value to patch
   * @param context an object map of @angular/core symbol names to symbols which will be available
   * in the context of the compiled expression
   * @param sourceUrl a URL to use for the source map of the compiled expression
   * @param preStatements a collection of statements that should be evaluated before the expression.
   */
  jitExpression(def, context, sourceUrl, preStatements) {
    const statements = [
      ...preStatements,
      new DeclareVarStmt("$def", def, void 0, StmtModifier.Exported)
    ];
    const res = this.jitEvaluator.evaluateStatements(
      sourceUrl,
      statements,
      new R3JitReflector(context),
      /* enableSourceMaps */
      true
    );
    return res["$def"];
  }
}
function convertToR3QueryMetadata(facade) {
  return {
    ...facade,
    isSignal: facade.isSignal,
    predicate: convertQueryPredicate(facade.predicate),
    read: facade.read ? new WrappedNodeExpr(facade.read) : null,
    static: facade.static,
    emitDistinctChangesOnly: facade.emitDistinctChangesOnly
  };
}
function convertQueryDeclarationToMetadata(declaration) {
  return {
    propertyName: declaration.propertyName,
    first: declaration.first ?? false,
    predicate: convertQueryPredicate(declaration.predicate),
    descendants: declaration.descendants ?? false,
    read: declaration.read ? new WrappedNodeExpr(declaration.read) : null,
    static: declaration.static ?? false,
    emitDistinctChangesOnly: declaration.emitDistinctChangesOnly ?? true,
    isSignal: !!declaration.isSignal
  };
}
function convertQueryPredicate(predicate) {
  return Array.isArray(predicate) ? (
    // The predicate is an array of strings so pass it through.
    predicate
  ) : (
    // The predicate is a type - assume that we will need to unwrap any `forwardRef()` calls.
    createMayBeForwardRefExpression(
      new WrappedNodeExpr(predicate),
      1
      /* ForwardRefHandling.Wrapped */
    )
  );
}
function convertDirectiveFacadeToMetadata(facade) {
  const inputsFromMetadata = parseInputsArray(facade.inputs || []);
  const outputsFromMetadata = parseMappingStringArray(facade.outputs || []);
  const propMetadata = facade.propMetadata;
  const inputsFromType = {};
  const outputsFromType = {};
  for (const field in propMetadata) {
    if (propMetadata.hasOwnProperty(field)) {
      propMetadata[field].forEach((ann) => {
        if (isInput(ann)) {
          inputsFromType[field] = {
            bindingPropertyName: ann.alias || field,
            classPropertyName: field,
            required: ann.required || false,
            // For JIT, decorators are used to declare signal inputs. That is because of
            // a technical limitation where it's not possible to statically reflect class
            // members of a directive/component at runtime before instantiating the class.
            isSignal: !!ann.isSignal,
            transformFunction: ann.transform != null ? new WrappedNodeExpr(ann.transform) : null
          };
        } else if (isOutput(ann)) {
          outputsFromType[field] = ann.alias || field;
        }
      });
    }
  }
  const hostDirectives = facade.hostDirectives?.length ? facade.hostDirectives.map((hostDirective) => {
    return typeof hostDirective === "function" ? {
      directive: wrapReference(hostDirective),
      inputs: null,
      outputs: null,
      isForwardReference: false
    } : {
      directive: wrapReference(hostDirective.directive),
      isForwardReference: false,
      inputs: hostDirective.inputs ? parseMappingStringArray(hostDirective.inputs) : null,
      outputs: hostDirective.outputs ? parseMappingStringArray(hostDirective.outputs) : null
    };
  }) : null;
  return {
    ...facade,
    typeArgumentCount: 0,
    typeSourceSpan: facade.typeSourceSpan,
    type: wrapReference(facade.type),
    deps: null,
    host: {
      ...extractHostBindings(facade.propMetadata, facade.typeSourceSpan, facade.host)
    },
    inputs: { ...inputsFromMetadata, ...inputsFromType },
    outputs: { ...outputsFromMetadata, ...outputsFromType },
    queries: facade.queries.map(convertToR3QueryMetadata),
    providers: facade.providers != null ? new WrappedNodeExpr(facade.providers) : null,
    viewQueries: facade.viewQueries.map(convertToR3QueryMetadata),
    fullInheritance: false,
    hostDirectives
  };
}
function convertDeclareDirectiveFacadeToMetadata(declaration, typeSourceSpan) {
  const hostDirectives = declaration.hostDirectives?.length ? declaration.hostDirectives.map((dir) => ({
    directive: wrapReference(dir.directive),
    isForwardReference: false,
    inputs: dir.inputs ? getHostDirectiveBindingMapping(dir.inputs) : null,
    outputs: dir.outputs ? getHostDirectiveBindingMapping(dir.outputs) : null
  })) : null;
  return {
    name: declaration.type.name,
    type: wrapReference(declaration.type),
    typeSourceSpan,
    selector: declaration.selector ?? null,
    inputs: declaration.inputs ? inputsPartialMetadataToInputMetadata(declaration.inputs) : {},
    outputs: declaration.outputs ?? {},
    host: convertHostDeclarationToMetadata(declaration.host),
    queries: (declaration.queries ?? []).map(convertQueryDeclarationToMetadata),
    viewQueries: (declaration.viewQueries ?? []).map(convertQueryDeclarationToMetadata),
    providers: declaration.providers !== void 0 ? new WrappedNodeExpr(declaration.providers) : null,
    exportAs: declaration.exportAs ?? null,
    usesInheritance: declaration.usesInheritance ?? false,
    lifecycle: { usesOnChanges: declaration.usesOnChanges ?? false },
    deps: null,
    typeArgumentCount: 0,
    fullInheritance: false,
    isStandalone: declaration.isStandalone ?? getJitStandaloneDefaultForVersion(declaration.version),
    isSignal: declaration.isSignal ?? false,
    hostDirectives
  };
}
function convertHostDeclarationToMetadata(host = {}) {
  return {
    attributes: convertOpaqueValuesToExpressions(host.attributes ?? {}),
    listeners: host.listeners ?? {},
    properties: host.properties ?? {},
    specialAttributes: {
      classAttr: host.classAttribute,
      styleAttr: host.styleAttribute
    }
  };
}
function getHostDirectiveBindingMapping(array) {
  let result = null;
  for (let i = 1; i < array.length; i += 2) {
    result = result || {};
    result[array[i - 1]] = array[i];
  }
  return result;
}
function convertOpaqueValuesToExpressions(obj) {
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = new WrappedNodeExpr(obj[key]);
  }
  return result;
}
function convertDeclareComponentFacadeToMetadata(decl, typeSourceSpan, sourceMapUrl) {
  const { template: template2, interpolation, defer: defer2 } = parseJitTemplate(decl.template, decl.type.name, sourceMapUrl, decl.preserveWhitespaces ?? false, decl.interpolation, decl.deferBlockDependencies);
  const declarations = [];
  if (decl.dependencies) {
    for (const innerDep of decl.dependencies) {
      switch (innerDep.kind) {
        case "directive":
        case "component":
          declarations.push(convertDirectiveDeclarationToMetadata(innerDep));
          break;
        case "pipe":
          declarations.push(convertPipeDeclarationToMetadata(innerDep));
          break;
      }
    }
  } else if (decl.components || decl.directives || decl.pipes) {
    decl.components && declarations.push(...decl.components.map((dir) => convertDirectiveDeclarationToMetadata(
      dir,
      /* isComponent */
      true
    )));
    decl.directives && declarations.push(...decl.directives.map((dir) => convertDirectiveDeclarationToMetadata(dir)));
    decl.pipes && declarations.push(...convertPipeMapToMetadata(decl.pipes));
  }
  return {
    ...convertDeclareDirectiveFacadeToMetadata(decl, typeSourceSpan),
    template: template2,
    styles: decl.styles ?? [],
    declarations,
    viewProviders: decl.viewProviders !== void 0 ? new WrappedNodeExpr(decl.viewProviders) : null,
    animations: decl.animations !== void 0 ? new WrappedNodeExpr(decl.animations) : null,
    defer: defer2,
    changeDetection: decl.changeDetection ?? ChangeDetectionStrategy.Default,
    encapsulation: decl.encapsulation ?? ViewEncapsulation.Emulated,
    interpolation,
    declarationListEmitMode: 2,
    relativeContextFilePath: "",
    i18nUseExternalIds: true
  };
}
function convertDeclarationFacadeToMetadata(declaration) {
  return {
    ...declaration,
    type: new WrappedNodeExpr(declaration.type)
  };
}
function convertDirectiveDeclarationToMetadata(declaration, isComponent = null) {
  return {
    kind: R3TemplateDependencyKind.Directive,
    isComponent: isComponent || declaration.kind === "component",
    selector: declaration.selector,
    type: new WrappedNodeExpr(declaration.type),
    inputs: declaration.inputs ?? [],
    outputs: declaration.outputs ?? [],
    exportAs: declaration.exportAs ?? null
  };
}
function convertPipeMapToMetadata(pipes) {
  if (!pipes) {
    return [];
  }
  return Object.keys(pipes).map((name) => {
    return {
      kind: R3TemplateDependencyKind.Pipe,
      name,
      type: new WrappedNodeExpr(pipes[name])
    };
  });
}
function convertPipeDeclarationToMetadata(pipe2) {
  return {
    kind: R3TemplateDependencyKind.Pipe,
    name: pipe2.name,
    type: new WrappedNodeExpr(pipe2.type)
  };
}
function parseJitTemplate(template2, typeName, sourceMapUrl, preserveWhitespaces, interpolation, deferBlockDependencies) {
  const interpolationConfig = interpolation ? InterpolationConfig.fromArray(interpolation) : DEFAULT_INTERPOLATION_CONFIG;
  const parsed = parseTemplate(template2, sourceMapUrl, {
    preserveWhitespaces,
    interpolationConfig
  });
  if (parsed.errors !== null) {
    const errors = parsed.errors.map((err) => err.toString()).join(", ");
    throw new Error(`Errors during JIT compilation of template for ${typeName}: ${errors}`);
  }
  const binder = new R3TargetBinder(new SelectorMatcher());
  const boundTarget = binder.bind({ template: parsed.nodes });
  return {
    template: parsed,
    interpolation: interpolationConfig,
    defer: createR3ComponentDeferMetadata(boundTarget, deferBlockDependencies)
  };
}
function convertToProviderExpression(obj, property2) {
  if (obj.hasOwnProperty(property2)) {
    return createMayBeForwardRefExpression(
      new WrappedNodeExpr(obj[property2]),
      0
      /* ForwardRefHandling.None */
    );
  } else {
    return void 0;
  }
}
function wrapExpression(obj, property2) {
  if (obj.hasOwnProperty(property2)) {
    return new WrappedNodeExpr(obj[property2]);
  } else {
    return void 0;
  }
}
function computeProvidedIn(providedIn) {
  const expression = typeof providedIn === "function" ? new WrappedNodeExpr(providedIn) : new LiteralExpr(providedIn ?? null);
  return createMayBeForwardRefExpression(
    expression,
    0
    /* ForwardRefHandling.None */
  );
}
function convertR3DependencyMetadataArray(facades) {
  return facades == null ? null : facades.map(convertR3DependencyMetadata);
}
function convertR3DependencyMetadata(facade) {
  const isAttributeDep = facade.attribute != null;
  const rawToken = facade.token === null ? null : new WrappedNodeExpr(facade.token);
  const token = isAttributeDep ? new WrappedNodeExpr(facade.attribute) : rawToken;
  return createR3DependencyMetadata(token, isAttributeDep, facade.host, facade.optional, facade.self, facade.skipSelf);
}
function convertR3DeclareDependencyMetadata(facade) {
  const isAttributeDep = facade.attribute ?? false;
  const token = facade.token === null ? null : new WrappedNodeExpr(facade.token);
  return createR3DependencyMetadata(token, isAttributeDep, facade.host ?? false, facade.optional ?? false, facade.self ?? false, facade.skipSelf ?? false);
}
function createR3DependencyMetadata(token, isAttributeDep, host, optional, self, skipSelf) {
  const attributeNameType = isAttributeDep ? literal("unknown") : null;
  return { token, attributeNameType, host, optional, self, skipSelf };
}
function createR3ComponentDeferMetadata(boundTarget, deferBlockDependencies) {
  const deferredBlocks = boundTarget.getDeferBlocks();
  const blocks = /* @__PURE__ */ new Map();
  for (let i = 0; i < deferredBlocks.length; i++) {
    const dependencyFn = deferBlockDependencies?.[i];
    blocks.set(deferredBlocks[i], dependencyFn ? new WrappedNodeExpr(dependencyFn) : null);
  }
  return { mode: 0, blocks };
}
function extractHostBindings(propMetadata, sourceSpan, host) {
  const bindings = parseHostBindings(host || {});
  const errors = verifyHostBindings(bindings, sourceSpan);
  if (errors.length) {
    throw new Error(errors.map((error2) => error2.msg).join("\n"));
  }
  for (const field in propMetadata) {
    if (propMetadata.hasOwnProperty(field)) {
      propMetadata[field].forEach((ann) => {
        if (isHostBinding(ann)) {
          bindings.properties[ann.hostPropertyName || field] = getSafePropertyAccessString("this", field);
        } else if (isHostListener(ann)) {
          bindings.listeners[ann.eventName || field] = `${field}(${(ann.args || []).join(",")})`;
        }
      });
    }
  }
  return bindings;
}
function isHostBinding(value) {
  return value.ngMetadataName === "HostBinding";
}
function isHostListener(value) {
  return value.ngMetadataName === "HostListener";
}
function isInput(value) {
  return value.ngMetadataName === "Input";
}
function isOutput(value) {
  return value.ngMetadataName === "Output";
}
function inputsPartialMetadataToInputMetadata(inputs) {
  return Object.keys(inputs).reduce((result, minifiedClassName) => {
    const value = inputs[minifiedClassName];
    if (typeof value === "string" || Array.isArray(value)) {
      result[minifiedClassName] = parseLegacyInputPartialOutput(value);
    } else {
      result[minifiedClassName] = {
        bindingPropertyName: value.publicName,
        classPropertyName: minifiedClassName,
        transformFunction: value.transformFunction !== null ? new WrappedNodeExpr(value.transformFunction) : null,
        required: value.isRequired,
        isSignal: value.isSignal
      };
    }
    return result;
  }, {});
}
function parseLegacyInputPartialOutput(value) {
  if (typeof value === "string") {
    return {
      bindingPropertyName: value,
      classPropertyName: value,
      transformFunction: null,
      required: false,
      // legacy partial output does not capture signal inputs.
      isSignal: false
    };
  }
  return {
    bindingPropertyName: value[0],
    classPropertyName: value[1],
    transformFunction: value[2] ? new WrappedNodeExpr(value[2]) : null,
    required: false,
    // legacy partial output does not capture signal inputs.
    isSignal: false
  };
}
function parseInputsArray(values) {
  return values.reduce((results, value) => {
    if (typeof value === "string") {
      const [bindingPropertyName, classPropertyName] = parseMappingString(value);
      results[classPropertyName] = {
        bindingPropertyName,
        classPropertyName,
        required: false,
        // Signal inputs not supported for the inputs array.
        isSignal: false,
        transformFunction: null
      };
    } else {
      results[value.name] = {
        bindingPropertyName: value.alias || value.name,
        classPropertyName: value.name,
        required: value.required || false,
        // Signal inputs not supported for the inputs array.
        isSignal: false,
        transformFunction: value.transform != null ? new WrappedNodeExpr(value.transform) : null
      };
    }
    return results;
  }, {});
}
function parseMappingStringArray(values) {
  return values.reduce((results, value) => {
    const [alias, fieldName] = parseMappingString(value);
    results[fieldName] = alias;
    return results;
  }, {});
}
function parseMappingString(value) {
  const [fieldName, bindingPropertyName] = value.split(":", 2).map((str) => str.trim());
  return [bindingPropertyName ?? fieldName, fieldName];
}
function convertDeclarePipeFacadeToMetadata(declaration) {
  return {
    name: declaration.type.name,
    type: wrapReference(declaration.type),
    typeArgumentCount: 0,
    pipeName: declaration.name,
    deps: null,
    pure: declaration.pure ?? true,
    isStandalone: declaration.isStandalone ?? getJitStandaloneDefaultForVersion(declaration.version)
  };
}
function convertDeclareInjectorFacadeToMetadata(declaration) {
  return {
    name: declaration.type.name,
    type: wrapReference(declaration.type),
    providers: declaration.providers !== void 0 && declaration.providers.length > 0 ? new WrappedNodeExpr(declaration.providers) : null,
    imports: declaration.imports !== void 0 ? declaration.imports.map((i) => new WrappedNodeExpr(i)) : []
  };
}
function publishFacade(global) {
  const ng = global.ng || (global.ng = {});
  ng.ɵcompilerFacade = new CompilerFacadeImpl();
}
const VERSION = new Version("19.0.5");
class CompilerConfig {
  defaultEncapsulation;
  preserveWhitespaces;
  strictInjectionParameters;
  constructor({ defaultEncapsulation = ViewEncapsulation.Emulated, preserveWhitespaces, strictInjectionParameters } = {}) {
    this.defaultEncapsulation = defaultEncapsulation;
    this.preserveWhitespaces = preserveWhitespacesDefault(noUndefined(preserveWhitespaces));
    this.strictInjectionParameters = strictInjectionParameters === true;
  }
}
function preserveWhitespacesDefault(preserveWhitespacesOption, defaultSetting = false) {
  return preserveWhitespacesOption === null ? defaultSetting : preserveWhitespacesOption;
}
const _I18N_ATTR = "i18n";
const _I18N_ATTR_PREFIX = "i18n-";
const _I18N_COMMENT_PREFIX_REGEXP = /^i18n:?/;
const MEANING_SEPARATOR = "|";
const ID_SEPARATOR = "@@";
let i18nCommentsWarned = false;
function extractMessages(nodes, interpolationConfig, implicitTags, implicitAttrs, preserveSignificantWhitespace) {
  const visitor = new _Visitor(implicitTags, implicitAttrs, preserveSignificantWhitespace);
  return visitor.extract(nodes, interpolationConfig);
}
function mergeTranslations(nodes, translations, interpolationConfig, implicitTags, implicitAttrs) {
  const visitor = new _Visitor(implicitTags, implicitAttrs);
  return visitor.merge(nodes, translations, interpolationConfig);
}
class ExtractionResult {
  messages;
  errors;
  constructor(messages, errors) {
    this.messages = messages;
    this.errors = errors;
  }
}
var _VisitorMode;
(function(_VisitorMode2) {
  _VisitorMode2[_VisitorMode2["Extract"] = 0] = "Extract";
  _VisitorMode2[_VisitorMode2["Merge"] = 1] = "Merge";
})(_VisitorMode || (_VisitorMode = {}));
class _Visitor {
  _implicitTags;
  _implicitAttrs;
  _preserveSignificantWhitespace;
  // Using non-null assertions because all variables are (re)set in init()
  _depth;
  // <el i18n>...</el>
  _inI18nNode;
  _inImplicitNode;
  // <!--i18n-->...<!--/i18n-->
  _inI18nBlock;
  _blockMeaningAndDesc;
  _blockChildren;
  _blockStartDepth;
  // {<icu message>}
  _inIcu;
  // set to void 0 when not in a section
  _msgCountAtSectionStart;
  _errors;
  _mode;
  // _VisitorMode.Extract only
  _messages;
  // _VisitorMode.Merge only
  _translations;
  _createI18nMessage;
  constructor(_implicitTags, _implicitAttrs, _preserveSignificantWhitespace = true) {
    this._implicitTags = _implicitTags;
    this._implicitAttrs = _implicitAttrs;
    this._preserveSignificantWhitespace = _preserveSignificantWhitespace;
  }
  /**
   * Extracts the messages from the tree
   */
  extract(nodes, interpolationConfig) {
    this._init(_VisitorMode.Extract, interpolationConfig);
    nodes.forEach((node) => node.visit(this, null));
    if (this._inI18nBlock) {
      this._reportError(nodes[nodes.length - 1], "Unclosed block");
    }
    return new ExtractionResult(this._messages, this._errors);
  }
  /**
   * Returns a tree where all translatable nodes are translated
   */
  merge(nodes, translations, interpolationConfig) {
    this._init(_VisitorMode.Merge, interpolationConfig);
    this._translations = translations;
    const wrapper = new Element("wrapper", [], nodes, void 0, void 0, void 0);
    const translatedNode = wrapper.visit(this, null);
    if (this._inI18nBlock) {
      this._reportError(nodes[nodes.length - 1], "Unclosed block");
    }
    return new ParseTreeResult(translatedNode.children, this._errors);
  }
  visitExpansionCase(icuCase, context) {
    const expression = visitAll(this, icuCase.expression, context);
    if (this._mode === _VisitorMode.Merge) {
      return new ExpansionCase(icuCase.value, expression, icuCase.sourceSpan, icuCase.valueSourceSpan, icuCase.expSourceSpan);
    }
  }
  visitExpansion(icu, context) {
    this._mayBeAddBlockChildren(icu);
    const wasInIcu = this._inIcu;
    if (!this._inIcu) {
      if (this._isInTranslatableSection) {
        this._addMessage([icu]);
      }
      this._inIcu = true;
    }
    const cases = visitAll(this, icu.cases, context);
    if (this._mode === _VisitorMode.Merge) {
      icu = new Expansion(icu.switchValue, icu.type, cases, icu.sourceSpan, icu.switchValueSourceSpan);
    }
    this._inIcu = wasInIcu;
    return icu;
  }
  visitComment(comment, context) {
    const isOpening = _isOpeningComment(comment);
    if (isOpening && this._isInTranslatableSection) {
      this._reportError(comment, "Could not start a block inside a translatable section");
      return;
    }
    const isClosing = _isClosingComment(comment);
    if (isClosing && !this._inI18nBlock) {
      this._reportError(comment, "Trying to close an unopened block");
      return;
    }
    if (!this._inI18nNode && !this._inIcu) {
      if (!this._inI18nBlock) {
        if (isOpening) {
          if (!i18nCommentsWarned && console && console.warn) {
            i18nCommentsWarned = true;
            const details = comment.sourceSpan.details ? `, ${comment.sourceSpan.details}` : "";
            console.warn(`I18n comments are deprecated, use an <ng-container> element instead (${comment.sourceSpan.start}${details})`);
          }
          this._inI18nBlock = true;
          this._blockStartDepth = this._depth;
          this._blockChildren = [];
          this._blockMeaningAndDesc = comment.value.replace(_I18N_COMMENT_PREFIX_REGEXP, "").trim();
          this._openTranslatableSection(comment);
        }
      } else {
        if (isClosing) {
          if (this._depth == this._blockStartDepth) {
            this._closeTranslatableSection(comment, this._blockChildren);
            this._inI18nBlock = false;
            const message = this._addMessage(this._blockChildren, this._blockMeaningAndDesc);
            const nodes = this._translateMessage(comment, message);
            return visitAll(this, nodes);
          } else {
            this._reportError(comment, "I18N blocks should not cross element boundaries");
            return;
          }
        }
      }
    }
  }
  visitText(text2, context) {
    if (this._isInTranslatableSection) {
      this._mayBeAddBlockChildren(text2);
    }
    return text2;
  }
  visitElement(el, context) {
    this._mayBeAddBlockChildren(el);
    this._depth++;
    const wasInI18nNode = this._inI18nNode;
    const wasInImplicitNode = this._inImplicitNode;
    let childNodes = [];
    let translatedChildNodes = void 0;
    const i18nAttr = _getI18nAttr(el);
    const i18nMeta = i18nAttr ? i18nAttr.value : "";
    const isImplicit = this._implicitTags.some((tag) => el.name === tag) && !this._inIcu && !this._isInTranslatableSection;
    const isTopLevelImplicit = !wasInImplicitNode && isImplicit;
    this._inImplicitNode = wasInImplicitNode || isImplicit;
    if (!this._isInTranslatableSection && !this._inIcu) {
      if (i18nAttr || isTopLevelImplicit) {
        this._inI18nNode = true;
        const message = this._addMessage(el.children, i18nMeta);
        translatedChildNodes = this._translateMessage(el, message);
      }
      if (this._mode == _VisitorMode.Extract) {
        const isTranslatable = i18nAttr || isTopLevelImplicit;
        if (isTranslatable)
          this._openTranslatableSection(el);
        visitAll(this, el.children);
        if (isTranslatable)
          this._closeTranslatableSection(el, el.children);
      }
    } else {
      if (i18nAttr || isTopLevelImplicit) {
        this._reportError(el, "Could not mark an element as translatable inside a translatable section");
      }
      if (this._mode == _VisitorMode.Extract) {
        visitAll(this, el.children);
      }
    }
    if (this._mode === _VisitorMode.Merge) {
      const visitNodes = translatedChildNodes || el.children;
      visitNodes.forEach((child) => {
        const visited = child.visit(this, context);
        if (visited && !this._isInTranslatableSection) {
          childNodes = childNodes.concat(visited);
        }
      });
    }
    this._visitAttributesOf(el);
    this._depth--;
    this._inI18nNode = wasInI18nNode;
    this._inImplicitNode = wasInImplicitNode;
    if (this._mode === _VisitorMode.Merge) {
      const translatedAttrs = this._translateAttributes(el);
      return new Element(el.name, translatedAttrs, childNodes, el.sourceSpan, el.startSourceSpan, el.endSourceSpan);
    }
    return null;
  }
  visitAttribute(attribute2, context) {
    throw new Error("unreachable code");
  }
  visitBlock(block, context) {
    visitAll(this, block.children, context);
  }
  visitBlockParameter(parameter, context) {
  }
  visitLetDeclaration(decl, context) {
  }
  _init(mode, interpolationConfig) {
    this._mode = mode;
    this._inI18nBlock = false;
    this._inI18nNode = false;
    this._depth = 0;
    this._inIcu = false;
    this._msgCountAtSectionStart = void 0;
    this._errors = [];
    this._messages = [];
    this._inImplicitNode = false;
    this._createI18nMessage = createI18nMessageFactory(
      interpolationConfig,
      DEFAULT_CONTAINER_BLOCKS,
      // When dropping significant whitespace we need to retain whitespace tokens or
      // else we won't be able to reuse source spans because empty tokens would be
      // removed and cause a mismatch.
      /* retainEmptyTokens */
      !this._preserveSignificantWhitespace,
      /* preserveExpressionWhitespace */
      this._preserveSignificantWhitespace
    );
  }
  // looks for translatable attributes
  _visitAttributesOf(el) {
    const explicitAttrNameToValue = {};
    const implicitAttrNames = this._implicitAttrs[el.name] || [];
    el.attrs.filter((attr) => attr.name.startsWith(_I18N_ATTR_PREFIX)).forEach((attr) => explicitAttrNameToValue[attr.name.slice(_I18N_ATTR_PREFIX.length)] = attr.value);
    el.attrs.forEach((attr) => {
      if (attr.name in explicitAttrNameToValue) {
        this._addMessage([attr], explicitAttrNameToValue[attr.name]);
      } else if (implicitAttrNames.some((name) => attr.name === name)) {
        this._addMessage([attr]);
      }
    });
  }
  // add a translatable message
  _addMessage(ast, msgMeta) {
    if (ast.length == 0 || this._isEmptyAttributeValue(ast) || this._isPlaceholderOnlyAttributeValue(ast) || this._isPlaceholderOnlyMessage(ast)) {
      return null;
    }
    const { meaning, description, id } = _parseMessageMeta(msgMeta);
    const message = this._createI18nMessage(ast, meaning, description, id);
    this._messages.push(message);
    return message;
  }
  // Check for cases like `<div i18n-title title="">`.
  _isEmptyAttributeValue(ast) {
    if (!isAttrNode(ast))
      return false;
    const node = ast[0];
    return node.value.trim() === "";
  }
  // Check for cases like `<div i18n-title title="{{ name }}">`.
  _isPlaceholderOnlyAttributeValue(ast) {
    if (!isAttrNode(ast))
      return false;
    const tokens = ast[0].valueTokens ?? [];
    const interpolations = tokens.filter(
      (token) => token.type === 17
      /* TokenType.ATTR_VALUE_INTERPOLATION */
    );
    const plainText = tokens.filter(
      (token) => token.type === 16
      /* TokenType.ATTR_VALUE_TEXT */
    ).map((token) => token.parts[0].trim()).join("");
    return interpolations.length === 1 && plainText === "";
  }
  // Check for cases like `<div i18n>{{ name }}</div>`.
  _isPlaceholderOnlyMessage(ast) {
    if (!isTextNode(ast))
      return false;
    const tokens = ast[0].tokens;
    const interpolations = tokens.filter(
      (token) => token.type === 8
      /* TokenType.INTERPOLATION */
    );
    const plainText = tokens.filter(
      (token) => token.type === 5
      /* TokenType.TEXT */
    ).map((token) => token.parts[0].trim()).join("");
    return interpolations.length === 1 && plainText === "";
  }
  // Translates the given message given the `TranslationBundle`
  // This is used for translating elements / blocks - see `_translateAttributes` for attributes
  // no-op when called in extraction mode (returns [])
  _translateMessage(el, message) {
    if (message && this._mode === _VisitorMode.Merge) {
      const nodes = this._translations.get(message);
      if (nodes) {
        return nodes;
      }
      this._reportError(el, `Translation unavailable for message id="${this._translations.digest(message)}"`);
    }
    return [];
  }
  // translate the attributes of an element and remove i18n specific attributes
  _translateAttributes(el) {
    const attributes = el.attrs;
    const i18nParsedMessageMeta = {};
    attributes.forEach((attr) => {
      if (attr.name.startsWith(_I18N_ATTR_PREFIX)) {
        i18nParsedMessageMeta[attr.name.slice(_I18N_ATTR_PREFIX.length)] = _parseMessageMeta(attr.value);
      }
    });
    const translatedAttributes = [];
    attributes.forEach((attr) => {
      if (attr.name === _I18N_ATTR || attr.name.startsWith(_I18N_ATTR_PREFIX)) {
        return;
      }
      if (attr.value && attr.value != "" && i18nParsedMessageMeta.hasOwnProperty(attr.name)) {
        const { meaning, description, id } = i18nParsedMessageMeta[attr.name];
        const message = this._createI18nMessage([attr], meaning, description, id);
        const nodes = this._translations.get(message);
        if (nodes) {
          if (nodes.length == 0) {
            translatedAttributes.push(new Attribute(
              attr.name,
              "",
              attr.sourceSpan,
              void 0,
              void 0,
              void 0,
              void 0
              /* i18n */
            ));
          } else if (nodes[0] instanceof Text) {
            const value = nodes[0].value;
            translatedAttributes.push(new Attribute(
              attr.name,
              value,
              attr.sourceSpan,
              void 0,
              void 0,
              void 0,
              void 0
              /* i18n */
            ));
          } else {
            this._reportError(el, `Unexpected translation for attribute "${attr.name}" (id="${id || this._translations.digest(message)}")`);
          }
        } else {
          this._reportError(el, `Translation unavailable for attribute "${attr.name}" (id="${id || this._translations.digest(message)}")`);
        }
      } else {
        translatedAttributes.push(attr);
      }
    });
    return translatedAttributes;
  }
  /**
   * Add the node as a child of the block when:
   * - we are in a block,
   * - we are not inside a ICU message (those are handled separately),
   * - the node is a "direct child" of the block
   */
  _mayBeAddBlockChildren(node) {
    if (this._inI18nBlock && !this._inIcu && this._depth == this._blockStartDepth) {
      this._blockChildren.push(node);
    }
  }
  /**
   * Marks the start of a section, see `_closeTranslatableSection`
   */
  _openTranslatableSection(node) {
    if (this._isInTranslatableSection) {
      this._reportError(node, "Unexpected section start");
    } else {
      this._msgCountAtSectionStart = this._messages.length;
    }
  }
  /**
   * A translatable section could be:
   * - the content of translatable element,
   * - nodes between `<!-- i18n -->` and `<!-- /i18n -->` comments
   */
  get _isInTranslatableSection() {
    return this._msgCountAtSectionStart !== void 0;
  }
  /**
   * Terminates a section.
   *
   * If a section has only one significant children (comments not significant) then we should not
   * keep the message from this children:
   *
   * `<p i18n="meaning|description">{ICU message}</p>` would produce two messages:
   * - one for the <p> content with meaning and description,
   * - another one for the ICU message.
   *
   * In this case the last message is discarded as it contains less information (the AST is
   * otherwise identical).
   *
   * Note that we should still keep messages extracted from attributes inside the section (ie in the
   * ICU message here)
   */
  _closeTranslatableSection(node, directChildren) {
    if (!this._isInTranslatableSection) {
      this._reportError(node, "Unexpected section end");
      return;
    }
    const startIndex = this._msgCountAtSectionStart;
    const significantChildren = directChildren.reduce((count, node2) => count + (node2 instanceof Comment ? 0 : 1), 0);
    if (significantChildren == 1) {
      for (let i = this._messages.length - 1; i >= startIndex; i--) {
        const ast = this._messages[i].nodes;
        if (!(ast.length == 1 && ast[0] instanceof Text$2)) {
          this._messages.splice(i, 1);
          break;
        }
      }
    }
    this._msgCountAtSectionStart = void 0;
  }
  _reportError(node, msg) {
    this._errors.push(new I18nError(node.sourceSpan, msg));
  }
}
function _isOpeningComment(n) {
  return !!(n instanceof Comment && n.value && n.value.startsWith("i18n"));
}
function _isClosingComment(n) {
  return !!(n instanceof Comment && n.value && n.value === "/i18n");
}
function _getI18nAttr(p) {
  return p.attrs.find((attr) => attr.name === _I18N_ATTR) || null;
}
function _parseMessageMeta(i18n2) {
  if (!i18n2)
    return { meaning: "", description: "", id: "" };
  const idIndex = i18n2.indexOf(ID_SEPARATOR);
  const descIndex = i18n2.indexOf(MEANING_SEPARATOR);
  const [meaningAndDesc, id] = idIndex > -1 ? [i18n2.slice(0, idIndex), i18n2.slice(idIndex + 2)] : [i18n2, ""];
  const [meaning, description] = descIndex > -1 ? [meaningAndDesc.slice(0, descIndex), meaningAndDesc.slice(descIndex + 1)] : ["", meaningAndDesc];
  return { meaning, description, id: id.trim() };
}
function isTextNode(ast) {
  return ast.length === 1 && ast[0] instanceof Text;
}
function isAttrNode(ast) {
  return ast.length === 1 && ast[0] instanceof Attribute;
}
class XmlTagDefinition {
  closedByParent = false;
  implicitNamespacePrefix = null;
  isVoid = false;
  ignoreFirstLf = false;
  canSelfClose = true;
  preventNamespaceInheritance = false;
  requireExtraParent(currentParent) {
    return false;
  }
  isClosedByChild(name) {
    return false;
  }
  getContentType() {
    return TagContentType.PARSABLE_DATA;
  }
}
const _TAG_DEFINITION = new XmlTagDefinition();
function getXmlTagDefinition(tagName) {
  return _TAG_DEFINITION;
}
class XmlParser extends Parser$1 {
  constructor() {
    super(getXmlTagDefinition);
  }
  parse(source, url, options = {}) {
    return super.parse(source, url, { ...options, tokenizeBlocks: false, tokenizeLet: false });
  }
}
const _VERSION$1 = "1.2";
const _XMLNS$1 = "urn:oasis:names:tc:xliff:document:1.2";
const _DEFAULT_SOURCE_LANG$1 = "en";
const _PLACEHOLDER_TAG$2 = "x";
const _MARKER_TAG$1 = "mrk";
const _FILE_TAG = "file";
const _SOURCE_TAG$1 = "source";
const _SEGMENT_SOURCE_TAG = "seg-source";
const _ALT_TRANS_TAG = "alt-trans";
const _TARGET_TAG$1 = "target";
const _UNIT_TAG$1 = "trans-unit";
const _CONTEXT_GROUP_TAG = "context-group";
const _CONTEXT_TAG = "context";
class Xliff extends Serializer {
  write(messages, locale) {
    const visitor = new _WriteVisitor$1();
    const transUnits = [];
    messages.forEach((message) => {
      let contextTags = [];
      message.sources.forEach((source) => {
        let contextGroupTag = new Tag(_CONTEXT_GROUP_TAG, { purpose: "location" });
        contextGroupTag.children.push(new CR(10), new Tag(_CONTEXT_TAG, { "context-type": "sourcefile" }, [
          new Text$1(source.filePath)
        ]), new CR(10), new Tag(_CONTEXT_TAG, { "context-type": "linenumber" }, [
          new Text$1(`${source.startLine}`)
        ]), new CR(8));
        contextTags.push(new CR(8), contextGroupTag);
      });
      const transUnit = new Tag(_UNIT_TAG$1, { id: message.id, datatype: "html" });
      transUnit.children.push(new CR(8), new Tag(_SOURCE_TAG$1, {}, visitor.serialize(message.nodes)), ...contextTags);
      if (message.description) {
        transUnit.children.push(new CR(8), new Tag("note", { priority: "1", from: "description" }, [
          new Text$1(message.description)
        ]));
      }
      if (message.meaning) {
        transUnit.children.push(new CR(8), new Tag("note", { priority: "1", from: "meaning" }, [new Text$1(message.meaning)]));
      }
      transUnit.children.push(new CR(6));
      transUnits.push(new CR(6), transUnit);
    });
    const body = new Tag("body", {}, [...transUnits, new CR(4)]);
    const file = new Tag("file", {
      "source-language": locale || _DEFAULT_SOURCE_LANG$1,
      datatype: "plaintext",
      original: "ng2.template"
    }, [new CR(4), body, new CR(2)]);
    const xliff = new Tag("xliff", { version: _VERSION$1, xmlns: _XMLNS$1 }, [
      new CR(2),
      file,
      new CR()
    ]);
    return serialize$1([
      new Declaration({ version: "1.0", encoding: "UTF-8" }),
      new CR(),
      xliff,
      new CR()
    ]);
  }
  load(content, url) {
    const xliffParser = new XliffParser();
    const { locale, msgIdToHtml, errors } = xliffParser.parse(content, url);
    const i18nNodesByMsgId = {};
    const converter = new XmlToI18n$2();
    Object.keys(msgIdToHtml).forEach((msgId) => {
      const { i18nNodes, errors: e } = converter.convert(msgIdToHtml[msgId], url);
      errors.push(...e);
      i18nNodesByMsgId[msgId] = i18nNodes;
    });
    if (errors.length) {
      throw new Error(`xliff parse errors:
${errors.join("\n")}`);
    }
    return { locale, i18nNodesByMsgId };
  }
  digest(message) {
    return digest$1(message);
  }
}
class _WriteVisitor$1 {
  visitText(text2, context) {
    return [new Text$1(text2.value)];
  }
  visitContainer(container, context) {
    const nodes = [];
    container.children.forEach((node) => nodes.push(...node.visit(this)));
    return nodes;
  }
  visitIcu(icu, context) {
    const nodes = [new Text$1(`{${icu.expressionPlaceholder}, ${icu.type}, `)];
    Object.keys(icu.cases).forEach((c) => {
      nodes.push(new Text$1(`${c} {`), ...icu.cases[c].visit(this), new Text$1(`} `));
    });
    nodes.push(new Text$1(`}`));
    return nodes;
  }
  visitTagPlaceholder(ph, context) {
    const ctype = getCtypeForTag(ph.tag);
    if (ph.isVoid) {
      return [
        new Tag(_PLACEHOLDER_TAG$2, { id: ph.startName, ctype, "equiv-text": `<${ph.tag}/>` })
      ];
    }
    const startTagPh = new Tag(_PLACEHOLDER_TAG$2, {
      id: ph.startName,
      ctype,
      "equiv-text": `<${ph.tag}>`
    });
    const closeTagPh = new Tag(_PLACEHOLDER_TAG$2, {
      id: ph.closeName,
      ctype,
      "equiv-text": `</${ph.tag}>`
    });
    return [startTagPh, ...this.serialize(ph.children), closeTagPh];
  }
  visitPlaceholder(ph, context) {
    return [new Tag(_PLACEHOLDER_TAG$2, { id: ph.name, "equiv-text": `{{${ph.value}}}` })];
  }
  visitBlockPlaceholder(ph, context) {
    const ctype = `x-${ph.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const startTagPh = new Tag(_PLACEHOLDER_TAG$2, {
      id: ph.startName,
      ctype,
      "equiv-text": `@${ph.name}`
    });
    const closeTagPh = new Tag(_PLACEHOLDER_TAG$2, { id: ph.closeName, ctype, "equiv-text": `}` });
    return [startTagPh, ...this.serialize(ph.children), closeTagPh];
  }
  visitIcuPlaceholder(ph, context) {
    const equivText = `{${ph.value.expression}, ${ph.value.type}, ${Object.keys(ph.value.cases).map((value) => value + " {...}").join(" ")}}`;
    return [new Tag(_PLACEHOLDER_TAG$2, { id: ph.name, "equiv-text": equivText })];
  }
  serialize(nodes) {
    return [].concat(...nodes.map((node) => node.visit(this)));
  }
}
class XliffParser {
  // using non-null assertions because they're re(set) by parse()
  _unitMlString;
  _errors;
  _msgIdToHtml;
  _locale = null;
  parse(xliff, url) {
    this._unitMlString = null;
    this._msgIdToHtml = {};
    const xml = new XmlParser().parse(xliff, url);
    this._errors = xml.errors;
    visitAll(this, xml.rootNodes, null);
    return {
      msgIdToHtml: this._msgIdToHtml,
      errors: this._errors,
      locale: this._locale
    };
  }
  visitElement(element2, context) {
    switch (element2.name) {
      case _UNIT_TAG$1:
        this._unitMlString = null;
        const idAttr = element2.attrs.find((attr) => attr.name === "id");
        if (!idAttr) {
          this._addError(element2, `<${_UNIT_TAG$1}> misses the "id" attribute`);
        } else {
          const id = idAttr.value;
          if (this._msgIdToHtml.hasOwnProperty(id)) {
            this._addError(element2, `Duplicated translations for msg ${id}`);
          } else {
            visitAll(this, element2.children, null);
            if (typeof this._unitMlString === "string") {
              this._msgIdToHtml[id] = this._unitMlString;
            } else {
              this._addError(element2, `Message ${id} misses a translation`);
            }
          }
        }
        break;
      case _SOURCE_TAG$1:
      case _SEGMENT_SOURCE_TAG:
      case _ALT_TRANS_TAG:
        break;
      case _TARGET_TAG$1:
        const innerTextStart = element2.startSourceSpan.end.offset;
        const innerTextEnd = element2.endSourceSpan.start.offset;
        const content = element2.startSourceSpan.start.file.content;
        const innerText = content.slice(innerTextStart, innerTextEnd);
        this._unitMlString = innerText;
        break;
      case _FILE_TAG:
        const localeAttr = element2.attrs.find((attr) => attr.name === "target-language");
        if (localeAttr) {
          this._locale = localeAttr.value;
        }
        visitAll(this, element2.children, null);
        break;
      default:
        visitAll(this, element2.children, null);
    }
  }
  visitAttribute(attribute2, context) {
  }
  visitText(text2, context) {
  }
  visitComment(comment, context) {
  }
  visitExpansion(expansion, context) {
  }
  visitExpansionCase(expansionCase, context) {
  }
  visitBlock(block, context) {
  }
  visitBlockParameter(parameter, context) {
  }
  visitLetDeclaration(decl, context) {
  }
  _addError(node, message) {
    this._errors.push(new I18nError(node.sourceSpan, message));
  }
}
class XmlToI18n$2 {
  // using non-null assertion because it's re(set) by convert()
  _errors;
  convert(message, url) {
    const xmlIcu = new XmlParser().parse(message, url, { tokenizeExpansionForms: true });
    this._errors = xmlIcu.errors;
    const i18nNodes = this._errors.length > 0 || xmlIcu.rootNodes.length == 0 ? [] : [].concat(...visitAll(this, xmlIcu.rootNodes));
    return {
      i18nNodes,
      errors: this._errors
    };
  }
  visitText(text2, context) {
    return new Text$2(text2.value, text2.sourceSpan);
  }
  visitElement(el, context) {
    if (el.name === _PLACEHOLDER_TAG$2) {
      const nameAttr = el.attrs.find((attr) => attr.name === "id");
      if (nameAttr) {
        return new Placeholder("", nameAttr.value, el.sourceSpan);
      }
      this._addError(el, `<${_PLACEHOLDER_TAG$2}> misses the "id" attribute`);
      return null;
    }
    if (el.name === _MARKER_TAG$1) {
      return [].concat(...visitAll(this, el.children));
    }
    this._addError(el, `Unexpected tag`);
    return null;
  }
  visitExpansion(icu, context) {
    const caseMap = {};
    visitAll(this, icu.cases).forEach((c) => {
      caseMap[c.value] = new Container(c.nodes, icu.sourceSpan);
    });
    return new Icu(icu.switchValue, icu.type, caseMap, icu.sourceSpan);
  }
  visitExpansionCase(icuCase, context) {
    return {
      value: icuCase.value,
      nodes: visitAll(this, icuCase.expression)
    };
  }
  visitComment(comment, context) {
  }
  visitAttribute(attribute2, context) {
  }
  visitBlock(block, context) {
  }
  visitBlockParameter(parameter, context) {
  }
  visitLetDeclaration(decl, context) {
  }
  _addError(node, message) {
    this._errors.push(new I18nError(node.sourceSpan, message));
  }
}
function getCtypeForTag(tag) {
  switch (tag.toLowerCase()) {
    case "br":
      return "lb";
    case "img":
      return "image";
    default:
      return `x-${tag}`;
  }
}
const _VERSION = "2.0";
const _XMLNS = "urn:oasis:names:tc:xliff:document:2.0";
const _DEFAULT_SOURCE_LANG = "en";
const _PLACEHOLDER_TAG$1 = "ph";
const _PLACEHOLDER_SPANNING_TAG = "pc";
const _MARKER_TAG = "mrk";
const _XLIFF_TAG = "xliff";
const _SOURCE_TAG = "source";
const _TARGET_TAG = "target";
const _UNIT_TAG = "unit";
class Xliff2 extends Serializer {
  write(messages, locale) {
    const visitor = new _WriteVisitor();
    const units = [];
    messages.forEach((message) => {
      const unit = new Tag(_UNIT_TAG, { id: message.id });
      const notes = new Tag("notes");
      if (message.description || message.meaning) {
        if (message.description) {
          notes.children.push(new CR(8), new Tag("note", { category: "description" }, [new Text$1(message.description)]));
        }
        if (message.meaning) {
          notes.children.push(new CR(8), new Tag("note", { category: "meaning" }, [new Text$1(message.meaning)]));
        }
      }
      message.sources.forEach((source) => {
        notes.children.push(new CR(8), new Tag("note", { category: "location" }, [
          new Text$1(`${source.filePath}:${source.startLine}${source.endLine !== source.startLine ? "," + source.endLine : ""}`)
        ]));
      });
      notes.children.push(new CR(6));
      unit.children.push(new CR(6), notes);
      const segment = new Tag("segment");
      segment.children.push(new CR(8), new Tag(_SOURCE_TAG, {}, visitor.serialize(message.nodes)), new CR(6));
      unit.children.push(new CR(6), segment, new CR(4));
      units.push(new CR(4), unit);
    });
    const file = new Tag("file", { "original": "ng.template", id: "ngi18n" }, [
      ...units,
      new CR(2)
    ]);
    const xliff = new Tag(_XLIFF_TAG, { version: _VERSION, xmlns: _XMLNS, srcLang: locale || _DEFAULT_SOURCE_LANG }, [new CR(2), file, new CR()]);
    return serialize$1([
      new Declaration({ version: "1.0", encoding: "UTF-8" }),
      new CR(),
      xliff,
      new CR()
    ]);
  }
  load(content, url) {
    const xliff2Parser = new Xliff2Parser();
    const { locale, msgIdToHtml, errors } = xliff2Parser.parse(content, url);
    const i18nNodesByMsgId = {};
    const converter = new XmlToI18n$1();
    Object.keys(msgIdToHtml).forEach((msgId) => {
      const { i18nNodes, errors: e } = converter.convert(msgIdToHtml[msgId], url);
      errors.push(...e);
      i18nNodesByMsgId[msgId] = i18nNodes;
    });
    if (errors.length) {
      throw new Error(`xliff2 parse errors:
${errors.join("\n")}`);
    }
    return { locale, i18nNodesByMsgId };
  }
  digest(message) {
    return decimalDigest(message);
  }
}
class _WriteVisitor {
  _nextPlaceholderId = 0;
  visitText(text2, context) {
    return [new Text$1(text2.value)];
  }
  visitContainer(container, context) {
    const nodes = [];
    container.children.forEach((node) => nodes.push(...node.visit(this)));
    return nodes;
  }
  visitIcu(icu, context) {
    const nodes = [new Text$1(`{${icu.expressionPlaceholder}, ${icu.type}, `)];
    Object.keys(icu.cases).forEach((c) => {
      nodes.push(new Text$1(`${c} {`), ...icu.cases[c].visit(this), new Text$1(`} `));
    });
    nodes.push(new Text$1(`}`));
    return nodes;
  }
  visitTagPlaceholder(ph, context) {
    const type = getTypeForTag(ph.tag);
    if (ph.isVoid) {
      const tagPh = new Tag(_PLACEHOLDER_TAG$1, {
        id: (this._nextPlaceholderId++).toString(),
        equiv: ph.startName,
        type,
        disp: `<${ph.tag}/>`
      });
      return [tagPh];
    }
    const tagPc = new Tag(_PLACEHOLDER_SPANNING_TAG, {
      id: (this._nextPlaceholderId++).toString(),
      equivStart: ph.startName,
      equivEnd: ph.closeName,
      type,
      dispStart: `<${ph.tag}>`,
      dispEnd: `</${ph.tag}>`
    });
    const nodes = [].concat(...ph.children.map((node) => node.visit(this)));
    if (nodes.length) {
      nodes.forEach((node) => tagPc.children.push(node));
    } else {
      tagPc.children.push(new Text$1(""));
    }
    return [tagPc];
  }
  visitPlaceholder(ph, context) {
    const idStr = (this._nextPlaceholderId++).toString();
    return [
      new Tag(_PLACEHOLDER_TAG$1, {
        id: idStr,
        equiv: ph.name,
        disp: `{{${ph.value}}}`
      })
    ];
  }
  visitBlockPlaceholder(ph, context) {
    const tagPc = new Tag(_PLACEHOLDER_SPANNING_TAG, {
      id: (this._nextPlaceholderId++).toString(),
      equivStart: ph.startName,
      equivEnd: ph.closeName,
      type: "other",
      dispStart: `@${ph.name}`,
      dispEnd: `}`
    });
    const nodes = [].concat(...ph.children.map((node) => node.visit(this)));
    if (nodes.length) {
      nodes.forEach((node) => tagPc.children.push(node));
    } else {
      tagPc.children.push(new Text$1(""));
    }
    return [tagPc];
  }
  visitIcuPlaceholder(ph, context) {
    const cases = Object.keys(ph.value.cases).map((value) => value + " {...}").join(" ");
    const idStr = (this._nextPlaceholderId++).toString();
    return [
      new Tag(_PLACEHOLDER_TAG$1, {
        id: idStr,
        equiv: ph.name,
        disp: `{${ph.value.expression}, ${ph.value.type}, ${cases}}`
      })
    ];
  }
  serialize(nodes) {
    this._nextPlaceholderId = 0;
    return [].concat(...nodes.map((node) => node.visit(this)));
  }
}
class Xliff2Parser {
  // using non-null assertions because they're all (re)set by parse()
  _unitMlString;
  _errors;
  _msgIdToHtml;
  _locale = null;
  parse(xliff, url) {
    this._unitMlString = null;
    this._msgIdToHtml = {};
    const xml = new XmlParser().parse(xliff, url);
    this._errors = xml.errors;
    visitAll(this, xml.rootNodes, null);
    return {
      msgIdToHtml: this._msgIdToHtml,
      errors: this._errors,
      locale: this._locale
    };
  }
  visitElement(element2, context) {
    switch (element2.name) {
      case _UNIT_TAG:
        this._unitMlString = null;
        const idAttr = element2.attrs.find((attr) => attr.name === "id");
        if (!idAttr) {
          this._addError(element2, `<${_UNIT_TAG}> misses the "id" attribute`);
        } else {
          const id = idAttr.value;
          if (this._msgIdToHtml.hasOwnProperty(id)) {
            this._addError(element2, `Duplicated translations for msg ${id}`);
          } else {
            visitAll(this, element2.children, null);
            if (typeof this._unitMlString === "string") {
              this._msgIdToHtml[id] = this._unitMlString;
            } else {
              this._addError(element2, `Message ${id} misses a translation`);
            }
          }
        }
        break;
      case _SOURCE_TAG:
        break;
      case _TARGET_TAG:
        const innerTextStart = element2.startSourceSpan.end.offset;
        const innerTextEnd = element2.endSourceSpan.start.offset;
        const content = element2.startSourceSpan.start.file.content;
        const innerText = content.slice(innerTextStart, innerTextEnd);
        this._unitMlString = innerText;
        break;
      case _XLIFF_TAG:
        const localeAttr = element2.attrs.find((attr) => attr.name === "trgLang");
        if (localeAttr) {
          this._locale = localeAttr.value;
        }
        const versionAttr = element2.attrs.find((attr) => attr.name === "version");
        if (versionAttr) {
          const version = versionAttr.value;
          if (version !== "2.0") {
            this._addError(element2, `The XLIFF file version ${version} is not compatible with XLIFF 2.0 serializer`);
          } else {
            visitAll(this, element2.children, null);
          }
        }
        break;
      default:
        visitAll(this, element2.children, null);
    }
  }
  visitAttribute(attribute2, context) {
  }
  visitText(text2, context) {
  }
  visitComment(comment, context) {
  }
  visitExpansion(expansion, context) {
  }
  visitExpansionCase(expansionCase, context) {
  }
  visitBlock(block, context) {
  }
  visitBlockParameter(parameter, context) {
  }
  visitLetDeclaration(decl, context) {
  }
  _addError(node, message) {
    this._errors.push(new I18nError(node.sourceSpan, message));
  }
}
class XmlToI18n$1 {
  // using non-null assertion because re(set) by convert()
  _errors;
  convert(message, url) {
    const xmlIcu = new XmlParser().parse(message, url, { tokenizeExpansionForms: true });
    this._errors = xmlIcu.errors;
    const i18nNodes = this._errors.length > 0 || xmlIcu.rootNodes.length == 0 ? [] : [].concat(...visitAll(this, xmlIcu.rootNodes));
    return {
      i18nNodes,
      errors: this._errors
    };
  }
  visitText(text2, context) {
    return new Text$2(text2.value, text2.sourceSpan);
  }
  visitElement(el, context) {
    switch (el.name) {
      case _PLACEHOLDER_TAG$1:
        const nameAttr = el.attrs.find((attr) => attr.name === "equiv");
        if (nameAttr) {
          return [new Placeholder("", nameAttr.value, el.sourceSpan)];
        }
        this._addError(el, `<${_PLACEHOLDER_TAG$1}> misses the "equiv" attribute`);
        break;
      case _PLACEHOLDER_SPANNING_TAG:
        const startAttr = el.attrs.find((attr) => attr.name === "equivStart");
        const endAttr = el.attrs.find((attr) => attr.name === "equivEnd");
        if (!startAttr) {
          this._addError(el, `<${_PLACEHOLDER_TAG$1}> misses the "equivStart" attribute`);
        } else if (!endAttr) {
          this._addError(el, `<${_PLACEHOLDER_TAG$1}> misses the "equivEnd" attribute`);
        } else {
          const startId = startAttr.value;
          const endId = endAttr.value;
          const nodes = [];
          return nodes.concat(new Placeholder("", startId, el.sourceSpan), ...el.children.map((node) => node.visit(this, null)), new Placeholder("", endId, el.sourceSpan));
        }
        break;
      case _MARKER_TAG:
        return [].concat(...visitAll(this, el.children));
      default:
        this._addError(el, `Unexpected tag`);
    }
    return null;
  }
  visitExpansion(icu, context) {
    const caseMap = {};
    visitAll(this, icu.cases).forEach((c) => {
      caseMap[c.value] = new Container(c.nodes, icu.sourceSpan);
    });
    return new Icu(icu.switchValue, icu.type, caseMap, icu.sourceSpan);
  }
  visitExpansionCase(icuCase, context) {
    return {
      value: icuCase.value,
      nodes: [].concat(...visitAll(this, icuCase.expression))
    };
  }
  visitComment(comment, context) {
  }
  visitAttribute(attribute2, context) {
  }
  visitBlock(block, context) {
  }
  visitBlockParameter(parameter, context) {
  }
  visitLetDeclaration(decl, context) {
  }
  _addError(node, message) {
    this._errors.push(new I18nError(node.sourceSpan, message));
  }
}
function getTypeForTag(tag) {
  switch (tag.toLowerCase()) {
    case "br":
    case "b":
    case "i":
    case "u":
      return "fmt";
    case "img":
      return "image";
    case "a":
      return "link";
    default:
      return "other";
  }
}
const _TRANSLATIONS_TAG = "translationbundle";
const _TRANSLATION_TAG = "translation";
const _PLACEHOLDER_TAG = "ph";
class Xtb extends Serializer {
  write(messages, locale) {
    throw new Error("Unsupported");
  }
  load(content, url) {
    const xtbParser = new XtbParser();
    const { locale, msgIdToHtml, errors } = xtbParser.parse(content, url);
    const i18nNodesByMsgId = {};
    const converter = new XmlToI18n();
    Object.keys(msgIdToHtml).forEach((msgId) => {
      const valueFn = function() {
        const { i18nNodes, errors: errors2 } = converter.convert(msgIdToHtml[msgId], url);
        if (errors2.length) {
          throw new Error(`xtb parse errors:
${errors2.join("\n")}`);
        }
        return i18nNodes;
      };
      createLazyProperty(i18nNodesByMsgId, msgId, valueFn);
    });
    if (errors.length) {
      throw new Error(`xtb parse errors:
${errors.join("\n")}`);
    }
    return { locale, i18nNodesByMsgId };
  }
  digest(message) {
    return digest(message);
  }
  createNameMapper(message) {
    return new SimplePlaceholderMapper(message, toPublicName);
  }
}
function createLazyProperty(messages, id, valueFn) {
  Object.defineProperty(messages, id, {
    configurable: true,
    enumerable: true,
    get: function() {
      const value = valueFn();
      Object.defineProperty(messages, id, { enumerable: true, value });
      return value;
    },
    set: (_) => {
      throw new Error("Could not overwrite an XTB translation");
    }
  });
}
class XtbParser {
  // using non-null assertions because they're (re)set by parse()
  _bundleDepth;
  _errors;
  _msgIdToHtml;
  _locale = null;
  parse(xtb, url) {
    this._bundleDepth = 0;
    this._msgIdToHtml = {};
    const xml = new XmlParser().parse(xtb, url);
    this._errors = xml.errors;
    visitAll(this, xml.rootNodes);
    return {
      msgIdToHtml: this._msgIdToHtml,
      errors: this._errors,
      locale: this._locale
    };
  }
  visitElement(element2, context) {
    switch (element2.name) {
      case _TRANSLATIONS_TAG:
        this._bundleDepth++;
        if (this._bundleDepth > 1) {
          this._addError(element2, `<${_TRANSLATIONS_TAG}> elements can not be nested`);
        }
        const langAttr = element2.attrs.find((attr) => attr.name === "lang");
        if (langAttr) {
          this._locale = langAttr.value;
        }
        visitAll(this, element2.children, null);
        this._bundleDepth--;
        break;
      case _TRANSLATION_TAG:
        const idAttr = element2.attrs.find((attr) => attr.name === "id");
        if (!idAttr) {
          this._addError(element2, `<${_TRANSLATION_TAG}> misses the "id" attribute`);
        } else {
          const id = idAttr.value;
          if (this._msgIdToHtml.hasOwnProperty(id)) {
            this._addError(element2, `Duplicated translations for msg ${id}`);
          } else {
            const innerTextStart = element2.startSourceSpan.end.offset;
            const innerTextEnd = element2.endSourceSpan.start.offset;
            const content = element2.startSourceSpan.start.file.content;
            const innerText = content.slice(innerTextStart, innerTextEnd);
            this._msgIdToHtml[id] = innerText;
          }
        }
        break;
      default:
        this._addError(element2, "Unexpected tag");
    }
  }
  visitAttribute(attribute2, context) {
  }
  visitText(text2, context) {
  }
  visitComment(comment, context) {
  }
  visitExpansion(expansion, context) {
  }
  visitExpansionCase(expansionCase, context) {
  }
  visitBlock(block, context) {
  }
  visitBlockParameter(block, context) {
  }
  visitLetDeclaration(decl, context) {
  }
  _addError(node, message) {
    this._errors.push(new I18nError(node.sourceSpan, message));
  }
}
class XmlToI18n {
  // using non-null assertion because it's (re)set by convert()
  _errors;
  convert(message, url) {
    const xmlIcu = new XmlParser().parse(message, url, { tokenizeExpansionForms: true });
    this._errors = xmlIcu.errors;
    const i18nNodes = this._errors.length > 0 || xmlIcu.rootNodes.length == 0 ? [] : visitAll(this, xmlIcu.rootNodes);
    return {
      i18nNodes,
      errors: this._errors
    };
  }
  visitText(text2, context) {
    return new Text$2(text2.value, text2.sourceSpan);
  }
  visitExpansion(icu, context) {
    const caseMap = {};
    visitAll(this, icu.cases).forEach((c) => {
      caseMap[c.value] = new Container(c.nodes, icu.sourceSpan);
    });
    return new Icu(icu.switchValue, icu.type, caseMap, icu.sourceSpan);
  }
  visitExpansionCase(icuCase, context) {
    return {
      value: icuCase.value,
      nodes: visitAll(this, icuCase.expression)
    };
  }
  visitElement(el, context) {
    if (el.name === _PLACEHOLDER_TAG) {
      const nameAttr = el.attrs.find((attr) => attr.name === "name");
      if (nameAttr) {
        return new Placeholder("", nameAttr.value, el.sourceSpan);
      }
      this._addError(el, `<${_PLACEHOLDER_TAG}> misses the "name" attribute`);
    } else {
      this._addError(el, `Unexpected tag`);
    }
    return null;
  }
  visitComment(comment, context) {
  }
  visitAttribute(attribute2, context) {
  }
  visitBlock(block, context) {
  }
  visitBlockParameter(block, context) {
  }
  visitLetDeclaration(decl, context) {
  }
  _addError(node, message) {
    this._errors.push(new I18nError(node.sourceSpan, message));
  }
}
class TranslationBundle {
  _i18nNodesByMsgId;
  digest;
  mapperFactory;
  _i18nToHtml;
  constructor(_i18nNodesByMsgId = {}, locale, digest2, mapperFactory, missingTranslationStrategy = MissingTranslationStrategy.Warning, console2) {
    this._i18nNodesByMsgId = _i18nNodesByMsgId;
    this.digest = digest2;
    this.mapperFactory = mapperFactory;
    this._i18nToHtml = new I18nToHtmlVisitor(_i18nNodesByMsgId, locale, digest2, mapperFactory, missingTranslationStrategy, console2);
  }
  // Creates a `TranslationBundle` by parsing the given `content` with the `serializer`.
  static load(content, url, serializer2, missingTranslationStrategy, console2) {
    const { locale, i18nNodesByMsgId } = serializer2.load(content, url);
    const digestFn = (m) => serializer2.digest(m);
    const mapperFactory = (m) => serializer2.createNameMapper(m);
    return new TranslationBundle(i18nNodesByMsgId, locale, digestFn, mapperFactory, missingTranslationStrategy, console2);
  }
  // Returns the translation as HTML nodes from the given source message.
  get(srcMsg) {
    const html = this._i18nToHtml.convert(srcMsg);
    if (html.errors.length) {
      throw new Error(html.errors.join("\n"));
    }
    return html.nodes;
  }
  has(srcMsg) {
    return this.digest(srcMsg) in this._i18nNodesByMsgId;
  }
}
class I18nToHtmlVisitor {
  _i18nNodesByMsgId;
  _locale;
  _digest;
  _mapperFactory;
  _missingTranslationStrategy;
  _console;
  // using non-null assertions because they're (re)set by convert()
  _srcMsg;
  _errors = [];
  _contextStack = [];
  _mapper;
  constructor(_i18nNodesByMsgId = {}, _locale, _digest, _mapperFactory, _missingTranslationStrategy, _console) {
    this._i18nNodesByMsgId = _i18nNodesByMsgId;
    this._locale = _locale;
    this._digest = _digest;
    this._mapperFactory = _mapperFactory;
    this._missingTranslationStrategy = _missingTranslationStrategy;
    this._console = _console;
  }
  convert(srcMsg) {
    this._contextStack.length = 0;
    this._errors.length = 0;
    const text2 = this._convertToText(srcMsg);
    const url = srcMsg.nodes[0].sourceSpan.start.file.url;
    const html = new HtmlParser().parse(text2, url, { tokenizeExpansionForms: true });
    return {
      nodes: html.rootNodes,
      errors: [...this._errors, ...html.errors]
    };
  }
  visitText(text2, context) {
    return escapeXml(text2.value);
  }
  visitContainer(container, context) {
    return container.children.map((n) => n.visit(this)).join("");
  }
  visitIcu(icu, context) {
    const cases = Object.keys(icu.cases).map((k) => `${k} {${icu.cases[k].visit(this)}}`);
    const exp = this._srcMsg.placeholders.hasOwnProperty(icu.expression) ? this._srcMsg.placeholders[icu.expression].text : icu.expression;
    return `{${exp}, ${icu.type}, ${cases.join(" ")}}`;
  }
  visitPlaceholder(ph, context) {
    const phName = this._mapper(ph.name);
    if (this._srcMsg.placeholders.hasOwnProperty(phName)) {
      return this._srcMsg.placeholders[phName].text;
    }
    if (this._srcMsg.placeholderToMessage.hasOwnProperty(phName)) {
      return this._convertToText(this._srcMsg.placeholderToMessage[phName]);
    }
    this._addError(ph, `Unknown placeholder "${ph.name}"`);
    return "";
  }
  // Loaded message contains only placeholders (vs tag and icu placeholders).
  // However when a translation can not be found, we need to serialize the source message
  // which can contain tag placeholders
  visitTagPlaceholder(ph, context) {
    const tag = `${ph.tag}`;
    const attrs = Object.keys(ph.attrs).map((name) => `${name}="${ph.attrs[name]}"`).join(" ");
    if (ph.isVoid) {
      return `<${tag} ${attrs}/>`;
    }
    const children = ph.children.map((c) => c.visit(this)).join("");
    return `<${tag} ${attrs}>${children}</${tag}>`;
  }
  // Loaded message contains only placeholders (vs tag and icu placeholders).
  // However when a translation can not be found, we need to serialize the source message
  // which can contain tag placeholders
  visitIcuPlaceholder(ph, context) {
    return this._convertToText(this._srcMsg.placeholderToMessage[ph.name]);
  }
  visitBlockPlaceholder(ph, context) {
    const params = ph.parameters.length === 0 ? "" : ` (${ph.parameters.join("; ")})`;
    const children = ph.children.map((c) => c.visit(this)).join("");
    return `@${ph.name}${params} {${children}}`;
  }
  /**
   * Convert a source message to a translated text string:
   * - text nodes are replaced with their translation,
   * - placeholders are replaced with their content,
   * - ICU nodes are converted to ICU expressions.
   */
  _convertToText(srcMsg) {
    const id = this._digest(srcMsg);
    const mapper = this._mapperFactory ? this._mapperFactory(srcMsg) : null;
    let nodes;
    this._contextStack.push({ msg: this._srcMsg, mapper: this._mapper });
    this._srcMsg = srcMsg;
    if (this._i18nNodesByMsgId.hasOwnProperty(id)) {
      nodes = this._i18nNodesByMsgId[id];
      this._mapper = (name) => mapper ? mapper.toInternalName(name) : name;
    } else {
      if (this._missingTranslationStrategy === MissingTranslationStrategy.Error) {
        const ctx = this._locale ? ` for locale "${this._locale}"` : "";
        this._addError(srcMsg.nodes[0], `Missing translation for message "${id}"${ctx}`);
      } else if (this._console && this._missingTranslationStrategy === MissingTranslationStrategy.Warning) {
        const ctx = this._locale ? ` for locale "${this._locale}"` : "";
        this._console.warn(`Missing translation for message "${id}"${ctx}`);
      }
      nodes = srcMsg.nodes;
      this._mapper = (name) => name;
    }
    const text2 = nodes.map((node) => node.visit(this)).join("");
    const context = this._contextStack.pop();
    this._srcMsg = context.msg;
    this._mapper = context.mapper;
    return text2;
  }
  _addError(el, msg) {
    this._errors.push(new I18nError(el.sourceSpan, msg));
  }
}
class I18NHtmlParser {
  _htmlParser;
  // @override
  getTagDefinition;
  _translationBundle;
  constructor(_htmlParser, translations, translationsFormat, missingTranslation = MissingTranslationStrategy.Warning, console2) {
    this._htmlParser = _htmlParser;
    if (translations) {
      const serializer2 = createSerializer(translationsFormat);
      this._translationBundle = TranslationBundle.load(translations, "i18n", serializer2, missingTranslation, console2);
    } else {
      this._translationBundle = new TranslationBundle({}, null, digest$1, void 0, missingTranslation, console2);
    }
  }
  parse(source, url, options = {}) {
    const interpolationConfig = options.interpolationConfig || DEFAULT_INTERPOLATION_CONFIG;
    const parseResult = this._htmlParser.parse(source, url, { interpolationConfig, ...options });
    if (parseResult.errors.length) {
      return new ParseTreeResult(parseResult.rootNodes, parseResult.errors);
    }
    return mergeTranslations(parseResult.rootNodes, this._translationBundle, interpolationConfig, [], {});
  }
}
function createSerializer(format) {
  format = (format || "xlf").toLowerCase();
  switch (format) {
    case "xmb":
      return new Xmb();
    case "xtb":
      return new Xtb();
    case "xliff2":
    case "xlf2":
      return new Xliff2();
    case "xliff":
    case "xlf":
    default:
      return new Xliff();
  }
}
class MessageBundle {
  _htmlParser;
  _implicitTags;
  _implicitAttrs;
  _locale;
  _preserveWhitespace;
  _messages = [];
  constructor(_htmlParser, _implicitTags, _implicitAttrs, _locale = null, _preserveWhitespace = true) {
    this._htmlParser = _htmlParser;
    this._implicitTags = _implicitTags;
    this._implicitAttrs = _implicitAttrs;
    this._locale = _locale;
    this._preserveWhitespace = _preserveWhitespace;
  }
  updateFromTemplate(source, url, interpolationConfig) {
    const htmlParserResult = this._htmlParser.parse(source, url, {
      tokenizeExpansionForms: true,
      interpolationConfig
    });
    if (htmlParserResult.errors.length) {
      return htmlParserResult.errors;
    }
    const rootNodes = this._preserveWhitespace ? htmlParserResult.rootNodes : visitAllWithSiblings(new WhitespaceVisitor(
      /* preserveSignificantWhitespace */
      false
    ), htmlParserResult.rootNodes);
    const i18nParserResult = extractMessages(
      rootNodes,
      interpolationConfig,
      this._implicitTags,
      this._implicitAttrs,
      /* preserveSignificantWhitespace */
      this._preserveWhitespace
    );
    if (i18nParserResult.errors.length) {
      return i18nParserResult.errors;
    }
    this._messages.push(...i18nParserResult.messages);
    return [];
  }
  // Return the message in the internal format
  // The public (serialized) format might be different, see the `write` method.
  getMessages() {
    return this._messages;
  }
  write(serializer2, filterSources) {
    const messages = {};
    const mapperVisitor = new MapPlaceholderNames();
    this._messages.forEach((message) => {
      const id = serializer2.digest(message);
      if (!messages.hasOwnProperty(id)) {
        messages[id] = message;
      } else {
        messages[id].sources.push(...message.sources);
      }
    });
    const msgList = Object.keys(messages).map((id) => {
      const mapper = serializer2.createNameMapper(messages[id]);
      const src = messages[id];
      const nodes = mapper ? mapperVisitor.convert(src.nodes, mapper) : src.nodes;
      let transformedMessage = new Message(nodes, {}, {}, src.meaning, src.description, id);
      transformedMessage.sources = src.sources;
      if (filterSources) {
        transformedMessage.sources.forEach((source) => source.filePath = filterSources(source.filePath));
      }
      return transformedMessage;
    });
    return serializer2.write(msgList, this._locale);
  }
}
class MapPlaceholderNames extends CloneVisitor {
  convert(nodes, mapper) {
    return mapper ? nodes.map((n) => n.visit(this, mapper)) : nodes;
  }
  visitTagPlaceholder(ph, mapper) {
    const startName = mapper.toPublicName(ph.startName);
    const closeName = ph.closeName ? mapper.toPublicName(ph.closeName) : ph.closeName;
    const children = ph.children.map((n) => n.visit(this, mapper));
    return new TagPlaceholder(ph.tag, ph.attrs, startName, closeName, children, ph.isVoid, ph.sourceSpan, ph.startSourceSpan, ph.endSourceSpan);
  }
  visitBlockPlaceholder(ph, mapper) {
    const startName = mapper.toPublicName(ph.startName);
    const closeName = ph.closeName ? mapper.toPublicName(ph.closeName) : ph.closeName;
    const children = ph.children.map((n) => n.visit(this, mapper));
    return new BlockPlaceholder(ph.name, ph.parameters, startName, closeName, children, ph.sourceSpan, ph.startSourceSpan, ph.endSourceSpan);
  }
  visitPlaceholder(ph, mapper) {
    return new Placeholder(ph.value, mapper.toPublicName(ph.name), ph.sourceSpan);
  }
  visitIcuPlaceholder(ph, mapper) {
    return new IcuPlaceholder(ph.value, mapper.toPublicName(ph.name), ph.sourceSpan);
  }
}
var FactoryTarget;
(function(FactoryTarget2) {
  FactoryTarget2[FactoryTarget2["Directive"] = 0] = "Directive";
  FactoryTarget2[FactoryTarget2["Component"] = 1] = "Component";
  FactoryTarget2[FactoryTarget2["Injectable"] = 2] = "Injectable";
  FactoryTarget2[FactoryTarget2["Pipe"] = 3] = "Pipe";
  FactoryTarget2[FactoryTarget2["NgModule"] = 4] = "NgModule";
})(FactoryTarget || (FactoryTarget = {}));
function compileClassMetadata(metadata) {
  const fnCall = internalCompileClassMetadata(metadata);
  return arrowFn([], [devOnlyGuardedExpression(fnCall).toStmt()]).callFn([]);
}
function internalCompileClassMetadata(metadata) {
  return importExpr(Identifiers.setClassMetadata).callFn([
    metadata.type,
    metadata.decorators,
    metadata.ctorParameters ?? literal(null),
    metadata.propDecorators ?? literal(null)
  ]);
}
function compileComponentClassMetadata(metadata, dependencies) {
  if (dependencies === null || dependencies.length === 0) {
    return compileClassMetadata(metadata);
  }
  return internalCompileSetClassMetadataAsync(metadata, dependencies.map((dep) => new FnParam(dep.symbolName, DYNAMIC_TYPE)), compileComponentMetadataAsyncResolver(dependencies));
}
function compileOpaqueAsyncClassMetadata(metadata, deferResolver, deferredDependencyNames) {
  return internalCompileSetClassMetadataAsync(metadata, deferredDependencyNames.map((name) => new FnParam(name, DYNAMIC_TYPE)), deferResolver);
}
function internalCompileSetClassMetadataAsync(metadata, wrapperParams, dependencyResolverFn) {
  const setClassMetadataCall = internalCompileClassMetadata(metadata);
  const setClassMetaWrapper = arrowFn(wrapperParams, [setClassMetadataCall.toStmt()]);
  const setClassMetaAsync = importExpr(Identifiers.setClassMetadataAsync).callFn([metadata.type, dependencyResolverFn, setClassMetaWrapper]);
  return arrowFn([], [devOnlyGuardedExpression(setClassMetaAsync).toStmt()]).callFn([]);
}
function compileComponentMetadataAsyncResolver(dependencies) {
  const dynamicImports = dependencies.map(({ symbolName, importPath, isDefaultImport }) => {
    const innerFn = (
      // Default imports are always accessed through the `default` property.
      arrowFn([new FnParam("m", DYNAMIC_TYPE)], variable("m").prop(isDefaultImport ? "default" : symbolName))
    );
    return new DynamicImportExpr(importPath).prop("then").callFn([innerFn]);
  });
  return arrowFn([], literalArr(dynamicImports));
}
function compileClassDebugInfo(debugInfo) {
  const debugInfoObject = {
    className: debugInfo.className
  };
  if (debugInfo.filePath) {
    debugInfoObject.filePath = debugInfo.filePath;
    debugInfoObject.lineNumber = debugInfo.lineNumber;
  }
  if (debugInfo.forbidOrphanRendering) {
    debugInfoObject.forbidOrphanRendering = literal(true);
  }
  const fnCall = importExpr(Identifiers.setClassDebugInfo).callFn([debugInfo.type, mapLiteral(debugInfoObject)]);
  const iife = arrowFn([], [devOnlyGuardedExpression(fnCall).toStmt()]);
  return iife.callFn([]);
}
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
function compileHmrInitializer(meta) {
  const id = encodeURIComponent(`${meta.filePath}@${meta.className}`);
  const urlPartial = `/@ng/component?c=${id}&t=`;
  const moduleName = "m";
  const dataName = "d";
  const timestampName = "t";
  const importCallbackName = `${meta.className}_HmrLoad`;
  const locals = meta.localDependencies.map((localName) => variable(localName));
  const namespaces = meta.namespaceDependencies.map((dep) => {
    return new ExternalExpr({ moduleName: dep.moduleName, name: null });
  });
  const defaultRead = variable(moduleName).prop("default");
  const replaceCall = importExpr(Identifiers.replaceMetadata).callFn([meta.type, defaultRead, literalArr(namespaces), literalArr(locals)]);
  const replaceCallback = arrowFn([new FnParam(moduleName)], defaultRead.and(replaceCall));
  const urlValue = literal(urlPartial).plus(variable("encodeURIComponent").callFn([variable(timestampName)]));
  const importCallback = new DeclareFunctionStmt(importCallbackName, [new FnParam(timestampName)], [
    // The vite-ignore special comment is required to prevent Vite from generating a superfluous
    // warning for each usage within the development code. If Vite provides a method to
    // programmatically avoid this warning in the future, this added comment can be removed here.
    new DynamicImportExpr(urlValue, null, "@vite-ignore").prop("then").callFn([replaceCallback]).toStmt()
  ], null, StmtModifier.Final);
  const updateCallback = arrowFn([new FnParam(dataName)], variable(dataName).prop("id").identical(literal(id)).and(variable(importCallbackName).callFn([variable(dataName).prop("timestamp")])));
  const initialCall = variable(importCallbackName).callFn([variable("Date").prop("now").callFn([])]);
  const hotRead = variable("import").prop("meta").prop("hot");
  const hotListener = hotRead.clone().prop("on").callFn([literal("angular:component-update"), updateCallback]);
  return arrowFn([], [
    // function Cmp_HmrLoad() {...}.
    importCallback,
    // ngDevMode && Cmp_HmrLoad(Date.now());
    devOnlyGuardedExpression(initialCall).toStmt(),
    // ngDevMode && import.meta.hot && import.meta.hot.on(...)
    devOnlyGuardedExpression(hotRead.and(hotListener)).toStmt()
  ]).callFn([]);
}
function compileHmrUpdateCallback(definitions, constantStatements, meta) {
  const namespaces = "ɵɵnamespaces";
  const params = [meta.className, namespaces, ...meta.localDependencies].map((name) => new FnParam(name, DYNAMIC_TYPE));
  const body = [];
  for (let i = 0; i < meta.namespaceDependencies.length; i++) {
    body.push(new DeclareVarStmt(meta.namespaceDependencies[i].assignedName, variable(namespaces).key(literal(i)), DYNAMIC_TYPE, StmtModifier.Final));
  }
  body.push(...constantStatements);
  for (const field of definitions) {
    if (field.initializer !== null) {
      body.push(variable(meta.className).prop(field.name).set(field.initializer).toStmt());
      for (const stmt of field.statements) {
        body.push(stmt);
      }
    }
  }
  return new DeclareFunctionStmt(`${meta.className}_UpdateMetadata`, params, body, null, StmtModifier.Final);
}
const MINIMUM_PARTIAL_LINKER_VERSION$5 = "12.0.0";
const MINIMUM_PARTIAL_LINKER_DEFER_SUPPORT_VERSION = "18.0.0";
function compileDeclareClassMetadata(metadata) {
  const definitionMap = new DefinitionMap();
  definitionMap.set("minVersion", literal(MINIMUM_PARTIAL_LINKER_VERSION$5));
  definitionMap.set("version", literal("19.0.5"));
  definitionMap.set("ngImport", importExpr(Identifiers.core));
  definitionMap.set("type", metadata.type);
  definitionMap.set("decorators", metadata.decorators);
  definitionMap.set("ctorParameters", metadata.ctorParameters);
  definitionMap.set("propDecorators", metadata.propDecorators);
  return importExpr(Identifiers.declareClassMetadata).callFn([definitionMap.toLiteralMap()]);
}
function compileComponentDeclareClassMetadata(metadata, dependencies) {
  if (dependencies === null || dependencies.length === 0) {
    return compileDeclareClassMetadata(metadata);
  }
  const definitionMap = new DefinitionMap();
  const callbackReturnDefinitionMap = new DefinitionMap();
  callbackReturnDefinitionMap.set("decorators", metadata.decorators);
  callbackReturnDefinitionMap.set("ctorParameters", metadata.ctorParameters ?? literal(null));
  callbackReturnDefinitionMap.set("propDecorators", metadata.propDecorators ?? literal(null));
  definitionMap.set("minVersion", literal(MINIMUM_PARTIAL_LINKER_DEFER_SUPPORT_VERSION));
  definitionMap.set("version", literal("19.0.5"));
  definitionMap.set("ngImport", importExpr(Identifiers.core));
  definitionMap.set("type", metadata.type);
  definitionMap.set("resolveDeferredDeps", compileComponentMetadataAsyncResolver(dependencies));
  definitionMap.set("resolveMetadata", arrowFn(dependencies.map((dep) => new FnParam(dep.symbolName, DYNAMIC_TYPE)), callbackReturnDefinitionMap.toLiteralMap()));
  return importExpr(Identifiers.declareClassMetadataAsync).callFn([definitionMap.toLiteralMap()]);
}
function toOptionalLiteralArray(values, mapper) {
  if (values === null || values.length === 0) {
    return null;
  }
  return literalArr(values.map((value) => mapper(value)));
}
function toOptionalLiteralMap(object, mapper) {
  const entries = Object.keys(object).map((key) => {
    const value = object[key];
    return { key, value: mapper(value), quoted: true };
  });
  if (entries.length > 0) {
    return literalMap(entries);
  } else {
    return null;
  }
}
function compileDependencies(deps) {
  if (deps === "invalid") {
    return literal("invalid");
  } else if (deps === null) {
    return literal(null);
  } else {
    return literalArr(deps.map(compileDependency));
  }
}
function compileDependency(dep) {
  const depMeta = new DefinitionMap();
  depMeta.set("token", dep.token);
  if (dep.attributeNameType !== null) {
    depMeta.set("attribute", literal(true));
  }
  if (dep.host) {
    depMeta.set("host", literal(true));
  }
  if (dep.optional) {
    depMeta.set("optional", literal(true));
  }
  if (dep.self) {
    depMeta.set("self", literal(true));
  }
  if (dep.skipSelf) {
    depMeta.set("skipSelf", literal(true));
  }
  return depMeta.toLiteralMap();
}
function compileDeclareDirectiveFromMetadata(meta) {
  const definitionMap = createDirectiveDefinitionMap(meta);
  const expression = importExpr(Identifiers.declareDirective).callFn([definitionMap.toLiteralMap()]);
  const type = createDirectiveType(meta);
  return { expression, type, statements: [] };
}
function createDirectiveDefinitionMap(meta) {
  const definitionMap = new DefinitionMap();
  const minVersion = getMinimumVersionForPartialOutput(meta);
  definitionMap.set("minVersion", literal(minVersion));
  definitionMap.set("version", literal("19.0.5"));
  definitionMap.set("type", meta.type.value);
  if (meta.isStandalone !== void 0) {
    definitionMap.set("isStandalone", literal(meta.isStandalone));
  }
  if (meta.isSignal) {
    definitionMap.set("isSignal", literal(meta.isSignal));
  }
  if (meta.selector !== null) {
    definitionMap.set("selector", literal(meta.selector));
  }
  definitionMap.set("inputs", needsNewInputPartialOutput(meta) ? createInputsPartialMetadata(meta.inputs) : legacyInputsPartialMetadata(meta.inputs));
  definitionMap.set("outputs", conditionallyCreateDirectiveBindingLiteral(meta.outputs));
  definitionMap.set("host", compileHostMetadata(meta.host));
  definitionMap.set("providers", meta.providers);
  if (meta.queries.length > 0) {
    definitionMap.set("queries", literalArr(meta.queries.map(compileQuery)));
  }
  if (meta.viewQueries.length > 0) {
    definitionMap.set("viewQueries", literalArr(meta.viewQueries.map(compileQuery)));
  }
  if (meta.exportAs !== null) {
    definitionMap.set("exportAs", asLiteral(meta.exportAs));
  }
  if (meta.usesInheritance) {
    definitionMap.set("usesInheritance", literal(true));
  }
  if (meta.lifecycle.usesOnChanges) {
    definitionMap.set("usesOnChanges", literal(true));
  }
  if (meta.hostDirectives?.length) {
    definitionMap.set("hostDirectives", createHostDirectives(meta.hostDirectives));
  }
  definitionMap.set("ngImport", importExpr(Identifiers.core));
  return definitionMap;
}
function getMinimumVersionForPartialOutput(meta) {
  let minVersion = "14.0.0";
  const hasDecoratorTransformFunctions = Object.values(meta.inputs).some((input) => input.transformFunction !== null);
  if (hasDecoratorTransformFunctions) {
    minVersion = "16.1.0";
  }
  if (needsNewInputPartialOutput(meta)) {
    minVersion = "17.1.0";
  }
  if (meta.queries.some((q) => q.isSignal) || meta.viewQueries.some((q) => q.isSignal)) {
    minVersion = "17.2.0";
  }
  return minVersion;
}
function needsNewInputPartialOutput(meta) {
  return Object.values(meta.inputs).some((input) => input.isSignal);
}
function compileQuery(query) {
  const meta = new DefinitionMap();
  meta.set("propertyName", literal(query.propertyName));
  if (query.first) {
    meta.set("first", literal(true));
  }
  meta.set("predicate", Array.isArray(query.predicate) ? asLiteral(query.predicate) : convertFromMaybeForwardRefExpression(query.predicate));
  if (!query.emitDistinctChangesOnly) {
    meta.set("emitDistinctChangesOnly", literal(false));
  }
  if (query.descendants) {
    meta.set("descendants", literal(true));
  }
  meta.set("read", query.read);
  if (query.static) {
    meta.set("static", literal(true));
  }
  if (query.isSignal) {
    meta.set("isSignal", literal(true));
  }
  return meta.toLiteralMap();
}
function compileHostMetadata(meta) {
  const hostMetadata = new DefinitionMap();
  hostMetadata.set("attributes", toOptionalLiteralMap(meta.attributes, (expression) => expression));
  hostMetadata.set("listeners", toOptionalLiteralMap(meta.listeners, literal));
  hostMetadata.set("properties", toOptionalLiteralMap(meta.properties, literal));
  if (meta.specialAttributes.styleAttr) {
    hostMetadata.set("styleAttribute", literal(meta.specialAttributes.styleAttr));
  }
  if (meta.specialAttributes.classAttr) {
    hostMetadata.set("classAttribute", literal(meta.specialAttributes.classAttr));
  }
  if (hostMetadata.values.length > 0) {
    return hostMetadata.toLiteralMap();
  } else {
    return null;
  }
}
function createHostDirectives(hostDirectives) {
  const expressions = hostDirectives.map((current) => {
    const keys = [
      {
        key: "directive",
        value: current.isForwardReference ? generateForwardRef(current.directive.type) : current.directive.type,
        quoted: false
      }
    ];
    const inputsLiteral = current.inputs ? createHostDirectivesMappingArray(current.inputs) : null;
    const outputsLiteral = current.outputs ? createHostDirectivesMappingArray(current.outputs) : null;
    if (inputsLiteral) {
      keys.push({ key: "inputs", value: inputsLiteral, quoted: false });
    }
    if (outputsLiteral) {
      keys.push({ key: "outputs", value: outputsLiteral, quoted: false });
    }
    return literalMap(keys);
  });
  return literalArr(expressions);
}
function createInputsPartialMetadata(inputs) {
  const keys = Object.getOwnPropertyNames(inputs);
  if (keys.length === 0) {
    return null;
  }
  return literalMap(keys.map((declaredName) => {
    const value = inputs[declaredName];
    return {
      key: declaredName,
      // put quotes around keys that contain potentially unsafe characters
      quoted: UNSAFE_OBJECT_KEY_NAME_REGEXP.test(declaredName),
      value: literalMap([
        { key: "classPropertyName", quoted: false, value: asLiteral(value.classPropertyName) },
        { key: "publicName", quoted: false, value: asLiteral(value.bindingPropertyName) },
        { key: "isSignal", quoted: false, value: asLiteral(value.isSignal) },
        { key: "isRequired", quoted: false, value: asLiteral(value.required) },
        { key: "transformFunction", quoted: false, value: value.transformFunction ?? NULL_EXPR }
      ])
    };
  }));
}
function legacyInputsPartialMetadata(inputs) {
  const keys = Object.getOwnPropertyNames(inputs);
  if (keys.length === 0) {
    return null;
  }
  return literalMap(keys.map((declaredName) => {
    const value = inputs[declaredName];
    const publicName = value.bindingPropertyName;
    const differentDeclaringName = publicName !== declaredName;
    let result;
    if (differentDeclaringName || value.transformFunction !== null) {
      const values = [asLiteral(publicName), asLiteral(declaredName)];
      if (value.transformFunction !== null) {
        values.push(value.transformFunction);
      }
      result = literalArr(values);
    } else {
      result = asLiteral(publicName);
    }
    return {
      key: declaredName,
      // put quotes around keys that contain potentially unsafe characters
      quoted: UNSAFE_OBJECT_KEY_NAME_REGEXP.test(declaredName),
      value: result
    };
  }));
}
function compileDeclareComponentFromMetadata(meta, template2, additionalTemplateInfo) {
  const definitionMap = createComponentDefinitionMap(meta, template2, additionalTemplateInfo);
  const expression = importExpr(Identifiers.declareComponent).callFn([definitionMap.toLiteralMap()]);
  const type = createComponentType(meta);
  return { expression, type, statements: [] };
}
function createComponentDefinitionMap(meta, template2, templateInfo) {
  const definitionMap = createDirectiveDefinitionMap(meta);
  const blockVisitor = new BlockPresenceVisitor();
  visitAll$1(blockVisitor, template2.nodes);
  definitionMap.set("template", getTemplateExpression(template2, templateInfo));
  if (templateInfo.isInline) {
    definitionMap.set("isInline", literal(true));
  }
  if (blockVisitor.hasBlocks) {
    definitionMap.set("minVersion", literal("17.0.0"));
  }
  definitionMap.set("styles", toOptionalLiteralArray(meta.styles, literal));
  definitionMap.set("dependencies", compileUsedDependenciesMetadata(meta));
  definitionMap.set("viewProviders", meta.viewProviders);
  definitionMap.set("animations", meta.animations);
  if (meta.changeDetection !== null) {
    if (typeof meta.changeDetection === "object") {
      throw new Error("Impossible state! Change detection flag is not resolved!");
    }
    definitionMap.set("changeDetection", importExpr(Identifiers.ChangeDetectionStrategy).prop(ChangeDetectionStrategy[meta.changeDetection]));
  }
  if (meta.encapsulation !== ViewEncapsulation.Emulated) {
    definitionMap.set("encapsulation", importExpr(Identifiers.ViewEncapsulation).prop(ViewEncapsulation[meta.encapsulation]));
  }
  if (meta.interpolation !== DEFAULT_INTERPOLATION_CONFIG) {
    definitionMap.set("interpolation", literalArr([literal(meta.interpolation.start), literal(meta.interpolation.end)]));
  }
  if (template2.preserveWhitespaces === true) {
    definitionMap.set("preserveWhitespaces", literal(true));
  }
  if (meta.defer.mode === 0) {
    const resolvers = [];
    let hasResolvers = false;
    for (const deps of meta.defer.blocks.values()) {
      if (deps === null) {
        resolvers.push(literal(null));
      } else {
        resolvers.push(deps);
        hasResolvers = true;
      }
    }
    if (hasResolvers) {
      definitionMap.set("deferBlockDependencies", literalArr(resolvers));
    }
  } else {
    throw new Error("Unsupported defer function emit mode in partial compilation");
  }
  return definitionMap;
}
function getTemplateExpression(template2, templateInfo) {
  if (templateInfo.inlineTemplateLiteralExpression !== null) {
    return templateInfo.inlineTemplateLiteralExpression;
  }
  if (templateInfo.isInline) {
    return literal(templateInfo.content, null, null);
  }
  const contents = templateInfo.content;
  const file = new ParseSourceFile(contents, templateInfo.sourceUrl);
  const start = new ParseLocation(file, 0, 0, 0);
  const end = computeEndLocation(file, contents);
  const span = new ParseSourceSpan(start, end);
  return literal(contents, null, span);
}
function computeEndLocation(file, contents) {
  const length = contents.length;
  let lineStart = 0;
  let lastLineStart = 0;
  let line = 0;
  do {
    lineStart = contents.indexOf("\n", lastLineStart);
    if (lineStart !== -1) {
      lastLineStart = lineStart + 1;
      line++;
    }
  } while (lineStart !== -1);
  return new ParseLocation(file, length, line, length - lastLineStart);
}
function compileUsedDependenciesMetadata(meta) {
  const wrapType = meta.declarationListEmitMode !== 0 ? generateForwardRef : (expr) => expr;
  if (meta.declarationListEmitMode === 3) {
    throw new Error(`Unsupported emit mode`);
  }
  return toOptionalLiteralArray(meta.declarations, (decl) => {
    switch (decl.kind) {
      case R3TemplateDependencyKind.Directive:
        const dirMeta = new DefinitionMap();
        dirMeta.set("kind", literal(decl.isComponent ? "component" : "directive"));
        dirMeta.set("type", wrapType(decl.type));
        dirMeta.set("selector", literal(decl.selector));
        dirMeta.set("inputs", toOptionalLiteralArray(decl.inputs, literal));
        dirMeta.set("outputs", toOptionalLiteralArray(decl.outputs, literal));
        dirMeta.set("exportAs", toOptionalLiteralArray(decl.exportAs, literal));
        return dirMeta.toLiteralMap();
      case R3TemplateDependencyKind.Pipe:
        const pipeMeta = new DefinitionMap();
        pipeMeta.set("kind", literal("pipe"));
        pipeMeta.set("type", wrapType(decl.type));
        pipeMeta.set("name", literal(decl.name));
        return pipeMeta.toLiteralMap();
      case R3TemplateDependencyKind.NgModule:
        const ngModuleMeta = new DefinitionMap();
        ngModuleMeta.set("kind", literal("ngmodule"));
        ngModuleMeta.set("type", wrapType(decl.type));
        return ngModuleMeta.toLiteralMap();
    }
  });
}
class BlockPresenceVisitor extends RecursiveVisitor$1 {
  hasBlocks = false;
  visitDeferredBlock() {
    this.hasBlocks = true;
  }
  visitDeferredBlockPlaceholder() {
    this.hasBlocks = true;
  }
  visitDeferredBlockLoading() {
    this.hasBlocks = true;
  }
  visitDeferredBlockError() {
    this.hasBlocks = true;
  }
  visitIfBlock() {
    this.hasBlocks = true;
  }
  visitIfBlockBranch() {
    this.hasBlocks = true;
  }
  visitForLoopBlock() {
    this.hasBlocks = true;
  }
  visitForLoopBlockEmpty() {
    this.hasBlocks = true;
  }
  visitSwitchBlock() {
    this.hasBlocks = true;
  }
  visitSwitchBlockCase() {
    this.hasBlocks = true;
  }
}
const MINIMUM_PARTIAL_LINKER_VERSION$4 = "12.0.0";
function compileDeclareFactoryFunction(meta) {
  const definitionMap = new DefinitionMap();
  definitionMap.set("minVersion", literal(MINIMUM_PARTIAL_LINKER_VERSION$4));
  definitionMap.set("version", literal("19.0.5"));
  definitionMap.set("ngImport", importExpr(Identifiers.core));
  definitionMap.set("type", meta.type.value);
  definitionMap.set("deps", compileDependencies(meta.deps));
  definitionMap.set("target", importExpr(Identifiers.FactoryTarget).prop(FactoryTarget$1[meta.target]));
  return {
    expression: importExpr(Identifiers.declareFactory).callFn([definitionMap.toLiteralMap()]),
    statements: [],
    type: createFactoryType(meta)
  };
}
const MINIMUM_PARTIAL_LINKER_VERSION$3 = "12.0.0";
function compileDeclareInjectableFromMetadata(meta) {
  const definitionMap = createInjectableDefinitionMap(meta);
  const expression = importExpr(Identifiers.declareInjectable).callFn([definitionMap.toLiteralMap()]);
  const type = createInjectableType(meta);
  return { expression, type, statements: [] };
}
function createInjectableDefinitionMap(meta) {
  const definitionMap = new DefinitionMap();
  definitionMap.set("minVersion", literal(MINIMUM_PARTIAL_LINKER_VERSION$3));
  definitionMap.set("version", literal("19.0.5"));
  definitionMap.set("ngImport", importExpr(Identifiers.core));
  definitionMap.set("type", meta.type.value);
  if (meta.providedIn !== void 0) {
    const providedIn = convertFromMaybeForwardRefExpression(meta.providedIn);
    if (providedIn.value !== null) {
      definitionMap.set("providedIn", providedIn);
    }
  }
  if (meta.useClass !== void 0) {
    definitionMap.set("useClass", convertFromMaybeForwardRefExpression(meta.useClass));
  }
  if (meta.useExisting !== void 0) {
    definitionMap.set("useExisting", convertFromMaybeForwardRefExpression(meta.useExisting));
  }
  if (meta.useValue !== void 0) {
    definitionMap.set("useValue", convertFromMaybeForwardRefExpression(meta.useValue));
  }
  if (meta.useFactory !== void 0) {
    definitionMap.set("useFactory", meta.useFactory);
  }
  if (meta.deps !== void 0) {
    definitionMap.set("deps", literalArr(meta.deps.map(compileDependency)));
  }
  return definitionMap;
}
const MINIMUM_PARTIAL_LINKER_VERSION$2 = "12.0.0";
function compileDeclareInjectorFromMetadata(meta) {
  const definitionMap = createInjectorDefinitionMap(meta);
  const expression = importExpr(Identifiers.declareInjector).callFn([definitionMap.toLiteralMap()]);
  const type = createInjectorType(meta);
  return { expression, type, statements: [] };
}
function createInjectorDefinitionMap(meta) {
  const definitionMap = new DefinitionMap();
  definitionMap.set("minVersion", literal(MINIMUM_PARTIAL_LINKER_VERSION$2));
  definitionMap.set("version", literal("19.0.5"));
  definitionMap.set("ngImport", importExpr(Identifiers.core));
  definitionMap.set("type", meta.type.value);
  definitionMap.set("providers", meta.providers);
  if (meta.imports.length > 0) {
    definitionMap.set("imports", literalArr(meta.imports));
  }
  return definitionMap;
}
const MINIMUM_PARTIAL_LINKER_VERSION$1 = "14.0.0";
function compileDeclareNgModuleFromMetadata(meta) {
  const definitionMap = createNgModuleDefinitionMap(meta);
  const expression = importExpr(Identifiers.declareNgModule).callFn([definitionMap.toLiteralMap()]);
  const type = createNgModuleType(meta);
  return { expression, type, statements: [] };
}
function createNgModuleDefinitionMap(meta) {
  const definitionMap = new DefinitionMap();
  if (meta.kind === R3NgModuleMetadataKind.Local) {
    throw new Error("Invalid path! Local compilation mode should not get into the partial compilation path");
  }
  definitionMap.set("minVersion", literal(MINIMUM_PARTIAL_LINKER_VERSION$1));
  definitionMap.set("version", literal("19.0.5"));
  definitionMap.set("ngImport", importExpr(Identifiers.core));
  definitionMap.set("type", meta.type.value);
  if (meta.bootstrap.length > 0) {
    definitionMap.set("bootstrap", refsToArray(meta.bootstrap, meta.containsForwardDecls));
  }
  if (meta.declarations.length > 0) {
    definitionMap.set("declarations", refsToArray(meta.declarations, meta.containsForwardDecls));
  }
  if (meta.imports.length > 0) {
    definitionMap.set("imports", refsToArray(meta.imports, meta.containsForwardDecls));
  }
  if (meta.exports.length > 0) {
    definitionMap.set("exports", refsToArray(meta.exports, meta.containsForwardDecls));
  }
  if (meta.schemas !== null && meta.schemas.length > 0) {
    definitionMap.set("schemas", literalArr(meta.schemas.map((ref) => ref.value)));
  }
  if (meta.id !== null) {
    definitionMap.set("id", meta.id);
  }
  return definitionMap;
}
const MINIMUM_PARTIAL_LINKER_VERSION = "14.0.0";
function compileDeclarePipeFromMetadata(meta) {
  const definitionMap = createPipeDefinitionMap(meta);
  const expression = importExpr(Identifiers.declarePipe).callFn([definitionMap.toLiteralMap()]);
  const type = createPipeType(meta);
  return { expression, type, statements: [] };
}
function createPipeDefinitionMap(meta) {
  const definitionMap = new DefinitionMap();
  definitionMap.set("minVersion", literal(MINIMUM_PARTIAL_LINKER_VERSION));
  definitionMap.set("version", literal("19.0.5"));
  definitionMap.set("ngImport", importExpr(Identifiers.core));
  definitionMap.set("type", meta.type.value);
  if (meta.isStandalone !== void 0) {
    definitionMap.set("isStandalone", literal(meta.isStandalone));
  }
  definitionMap.set("name", literal(meta.pipeName));
  if (meta.pure === false) {
    definitionMap.set("pure", literal(meta.pure));
  }
  return definitionMap;
}
publishFacade(_global);

export { AST, ASTWithName, ASTWithSource, AbsoluteSourceSpan, ArrayType, ArrowFunctionExpr, AstMemoryEfficientTransformer, AstTransformer, Attribute, Binary, BinaryOperator, BinaryOperatorExpr, BindingPipe, BindingType, Block, BlockParameter, BoundElementProperty, BuiltinType, BuiltinTypeName, CUSTOM_ELEMENTS_SCHEMA, Call, Chain, ChangeDetectionStrategy, CommaExpr, Comment, CompilerConfig, Conditional, ConditionalExpr, ConstantPool, CssSelector, DEFAULT_INTERPOLATION_CONFIG, DYNAMIC_TYPE, DeclareFunctionStmt, DeclareVarStmt, DomElementSchemaRegistry, DynamicImportExpr, EOF, Element, ElementSchemaRegistry, EmitterVisitorContext, EmptyExpr$1 as EmptyExpr, Expansion, ExpansionCase, Expression, ExpressionBinding, ExpressionStatement, ExpressionType, ExternalExpr, ExternalReference, FactoryTarget$1 as FactoryTarget, FunctionExpr, HtmlParser, HtmlTagDefinition, I18NHtmlParser, IfStmt, ImplicitReceiver, InstantiateExpr, Interpolation$1 as Interpolation, InterpolationConfig, InvokeFunctionExpr, JSDocComment, JitEvaluator, KeyedRead, KeyedWrite, LeadingComment, LetDeclaration, Lexer, LiteralArray, LiteralArrayExpr, LiteralExpr, LiteralMap, LiteralMapExpr, LiteralPrimitive, LocalizedString, MapType, MessageBundle, NONE_TYPE, NO_ERRORS_SCHEMA, NodeWithI18n, NonNullAssert, NotExpr, ParseError, ParseErrorLevel, ParseLocation, ParseSourceFile, ParseSourceSpan, ParseSpan, ParseTreeResult, ParsedEvent, ParsedEventType, ParsedProperty, ParsedPropertyType, ParsedVariable, Parser, ParserError, PrefixNot, PropertyRead, PropertyWrite, R3BoundTarget, Identifiers as R3Identifiers, R3NgModuleMetadataKind, R3SelectorScopeMode, R3TargetBinder, R3TemplateDependencyKind, ReadKeyExpr, ReadPropExpr, ReadVarExpr, RecursiveAstVisitor, RecursiveVisitor, ResourceLoader, ReturnStatement, STRING_TYPE, SafeCall, SafeKeyedRead, SafePropertyRead, SelectorContext, SelectorListContext, SelectorMatcher, Serializer, SplitInterpolation, Statement, StmtModifier, TagContentType, TaggedTemplateExpr, TemplateBindingParseResult, TemplateLiteral, TemplateLiteralElement, Text, ThisReceiver, BlockNode as TmplAstBlockNode, BoundAttribute as TmplAstBoundAttribute, BoundDeferredTrigger as TmplAstBoundDeferredTrigger, BoundEvent as TmplAstBoundEvent, BoundText as TmplAstBoundText, Content as TmplAstContent, DeferredBlock as TmplAstDeferredBlock, DeferredBlockError as TmplAstDeferredBlockError, DeferredBlockLoading as TmplAstDeferredBlockLoading, DeferredBlockPlaceholder as TmplAstDeferredBlockPlaceholder, DeferredTrigger as TmplAstDeferredTrigger, Element$1 as TmplAstElement, ForLoopBlock as TmplAstForLoopBlock, ForLoopBlockEmpty as TmplAstForLoopBlockEmpty, HoverDeferredTrigger as TmplAstHoverDeferredTrigger, Icu$1 as TmplAstIcu, IdleDeferredTrigger as TmplAstIdleDeferredTrigger, IfBlock as TmplAstIfBlock, IfBlockBranch as TmplAstIfBlockBranch, ImmediateDeferredTrigger as TmplAstImmediateDeferredTrigger, InteractionDeferredTrigger as TmplAstInteractionDeferredTrigger, LetDeclaration$1 as TmplAstLetDeclaration, NeverDeferredTrigger as TmplAstNeverDeferredTrigger, RecursiveVisitor$1 as TmplAstRecursiveVisitor, Reference as TmplAstReference, SwitchBlock as TmplAstSwitchBlock, SwitchBlockCase as TmplAstSwitchBlockCase, Template as TmplAstTemplate, Text$3 as TmplAstText, TextAttribute as TmplAstTextAttribute, TimerDeferredTrigger as TmplAstTimerDeferredTrigger, UnknownBlock as TmplAstUnknownBlock, Variable as TmplAstVariable, ViewportDeferredTrigger as TmplAstViewportDeferredTrigger, Token, TokenType, TransplantedType, TreeError, Type, TypeModifier, TypeofExpr, TypeofExpression, Unary, UnaryOperator, UnaryOperatorExpr, VERSION, VariableBinding, Version, ViewEncapsulation, WrappedNodeExpr, WriteKeyExpr, WritePropExpr, WriteVarExpr, Xliff, Xliff2, Xmb, XmlParser, Xtb, compileClassDebugInfo, compileClassMetadata, compileComponentClassMetadata, compileComponentDeclareClassMetadata, compileComponentFromMetadata, compileDeclareClassMetadata, compileDeclareComponentFromMetadata, compileDeclareDirectiveFromMetadata, compileDeclareFactoryFunction, compileDeclareInjectableFromMetadata, compileDeclareInjectorFromMetadata, compileDeclareNgModuleFromMetadata, compileDeclarePipeFromMetadata, compileDeferResolverFunction, compileDirectiveFromMetadata, compileFactoryFunction, compileHmrInitializer, compileHmrUpdateCallback, compileInjectable, compileInjector, compileNgModule, compileOpaqueAsyncClassMetadata, compilePipeFromMetadata, computeMsgId, core, createCssSelectorFromNode, createInjectableType, createMayBeForwardRefExpression, devOnlyGuardedExpression, emitDistinctChangesOnlyDefaultValue, encapsulateStyle, findMatchingDirectivesAndPipes, getHtmlTagDefinition, getNsPrefix, getSafePropertyAccessString, identifierName, isNgContainer, isNgContent, isNgTemplate, jsDocComment, leadingComment, literal, literalMap, makeBindingParser, mergeNsAndName, output_ast as outputAst, parseHostBindings, parseTemplate, preserveWhitespacesDefault, publishFacade, r3JitTypeSourceSpan, sanitizeIdentifier, splitNsName, visitAll$1 as tmplAstVisitAll, verifyHostBindings, visitAll };