"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const SignupForm_1 = __importDefault(require("../components/SignupForm"));
const SignupPage = () => {
    return (<div>
      <h1>Signup</h1>
      <SignupForm_1.default />
    </div>);
};
exports.default = SignupPage;
