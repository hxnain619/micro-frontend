import { importShared } from './__federation_fn_import-BPtpOTPO.js';

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
const {Component} = await importShared('@angular/core');

const {RouterOutlet} = await importShared('@angular/router');

let AppComponent = class {
  title = "remote-app";
};
AppComponent = __decorateClass([
  Component({
    selector: "app-root",
    imports: [RouterOutlet],
    templateUrl: "./app.component.html",
    styleUrl: "./app.component.css"
  })
], AppComponent);

export { AppComponent };
