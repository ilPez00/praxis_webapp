"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const GoalNodeDisplay_1 = __importDefault(require("./GoalNodeDisplay")); // Import the new component
const GoalTreeDisplay = ({ goals, userId, onGoalUpdated, onGoalDeleted }) => {
    return (<div>
      {goals.map((goal) => (<GoalNodeDisplay_1.default key={goal.id} goal={goal} userId={userId} onGoalUpdated={onGoalUpdated} onGoalDeleted={onGoalDeleted}/>))}
    </div>);
};
exports.default = GoalTreeDisplay;
