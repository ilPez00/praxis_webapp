"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const axios_1 = __importDefault(require("axios"));
const Domain_1 = require("../models/Domain"); // Import Domain enum
const GoalForm = ({ userId, parentGoalId, onGoalAdded }) => {
    const [name, setName] = (0, react_1.useState)('');
    const [domain, setDomain] = (0, react_1.useState)(Domain_1.Domain.HEALTH);
    const [weight, setWeight] = (0, react_1.useState)(1.0);
    const [message, setMessage] = (0, react_1.useState)('');
    const handleSubmit = (e) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        e.preventDefault();
        try {
            const response = yield axios_1.default.post(`http://localhost:3001/users/${userId}/goals`, {
                name,
                domain,
                weight,
                progress: 0, // New goals start with 0 progress
                subGoals: [],
                parentGoalId: parentGoalId, // Send parent ID if it's a sub-goal
            });
            setMessage(response.data.message);
            onGoalAdded(response.data.goal); // Pass the newly added goal to the parent
            setName('');
            setWeight(1.0);
            setDomain(Domain_1.Domain.HEALTH);
        }
        catch (error) {
            setMessage(((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to add goal.');
        }
    });
    return (<form onSubmit={handleSubmit}>
      <h3>{parentGoalId ? 'Add Sub-Goal' : 'Add New Goal'}</h3>
      <p>{message}</p>
      <div>
        <label>Name:</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required/>
      </div>
      <div>
        <label>Domain:</label>
        <select value={domain} onChange={(e) => setDomain(e.target.value)}>
          {Object.values(Domain_1.Domain).map((d) => (<option key={d} value={d}>{d}</option>))}
        </select>
      </div>
      <div>
        <label>Weight:</label>
        <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value))} required/>
      </div>
      <button type="submit">{parentGoalId ? 'Add Sub-Goal' : 'Add Goal'}</button>
    </form>);
};
exports.default = GoalForm;
