"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const LoginForm_1 = __importDefault(require("../components/LoginForm"));
const LoginPage = () => {
    return (<div>
      <h1>Login</h1>
      <LoginForm_1.default />
    </div>);
};
exports.default = LoginPage;
