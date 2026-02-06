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
const GoalNode_1 = require("../models/GoalNode");
const FeedbackGrade_1 = require("../models/FeedbackGrade");
const GoalForm_1 = __importDefault(require("./GoalForm")); // Import GoalForm
const GoalNodeDisplay = ({ goal, userId, onGoalUpdated, onGoalDeleted }) => {
    const [isEditing, setIsEditing] = (0, react_1.useState)(false);
    const [editedName, setEditedName] = (0, react_1.useState)(goal.name);
    const [editedProgress, setEditedProgress] = (0, react_1.useState)(goal.progress);
    const [editedWeight, setEditedWeight] = (0, react_1.useState)(goal.weight);
    const [showSubGoalForm, setShowSubGoalForm] = (0, react_1.useState)(false);
    const [showFeedbackForm, setShowFeedbackForm] = (0, react_1.useState)(false);
    const [feedbackGrade, setFeedbackGrade] = (0, react_1.useState)(FeedbackGrade_1.FeedbackGrade.NOT_APPLICABLE);
    const handleUpdateGoal = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.put(`http://localhost:3001/users/${userId}/goals/${goal.id}`, {
                name: editedName,
                progress: editedProgress,
                weight: editedWeight,
            });
            if (onGoalUpdated) {
                onGoalUpdated(response.data.goal);
            }
            setIsEditing(false);
        }
        catch (error) {
            console.error('Failed to update goal:', error);
        }
    });
    const handleDeleteGoal = () => __awaiter(void 0, void 0, void 0, function* () {
        if (window.confirm(`Are you sure you want to delete "${goal.name}" and all its subgoals?`)) {
            try {
                yield axios_1.default.delete(`http://localhost:3001/users/${userId}/goals/${goal.id}`);
                if (onGoalDeleted) {
                    onGoalDeleted(goal.id);
                }
            }
            catch (error) {
                console.error('Failed to delete goal:', error);
            }
        }
    });
    const handleSubGoalAdded = (newSubGoal) => {
        if (onGoalUpdated) {
            console.log('Sub-goal added:', newSubGoal);
        }
        setShowSubGoalForm(false);
    };
    const handleApplyFeedback = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const updatedGoal = (0, GoalNode_1.updateWeightFromGrade)(goal, feedbackGrade);
            const response = yield axios_1.default.put(`http://localhost:3001/users/${userId}/goals/${goal.id}`, {
                weight: updatedGoal.weight,
            });
            if (onGoalUpdated) {
                onGoalUpdated(response.data.goal);
            }
            setShowFeedbackForm(false);
        }
        catch (error) {
            console.error('Failed to apply feedback:', error);
        }
    });
    return (<div style={{ marginLeft: '20px', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
      {isEditing ? (<div>
          <input type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)}/>
          <input type="number" value={editedProgress} onChange={(e) => setEditedProgress(parseInt(e.target.value))}/>
          <input type="number" value={editedWeight} step="0.1" onChange={(e) => setEditedWeight(parseFloat(e.target.value))}/>
          <button onClick={handleUpdateGoal}>Save</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </div>) : (<div>
          <h3>{goal.name} ({goal.domain})</h3>
          <p>Progress: {goal.progress}%</p>
          <p>Weight: {goal.weight.toFixed(2)}</p>
          <button onClick={() => setIsEditing(true)}>Edit</button>
          <button onClick={handleDeleteGoal}>Delete</button>
          <button onClick={() => setShowSubGoalForm(!showSubGoalForm)}>
            {showSubGoalForm ? 'Cancel Add Sub-Goal' : 'Add Sub-Goal'}
          </button>
          <button onClick={() => setShowFeedbackForm(!showFeedbackForm)}>
            {showFeedbackForm ? 'Cancel Feedback' : 'Apply Feedback'}
          </button>

          {showSubGoalForm && (<GoalForm_1.default parentGoalId={goal.id} userId={userId} onGoalAdded={handleSubGoalAdded}/>)}

          {showFeedbackForm && (<div>
              <select value={feedbackGrade} onChange={(e) => setFeedbackGrade(e.target.value)}>
                {Object.values(FeedbackGrade_1.FeedbackGrade).map(grade => (<option key={grade} value={grade}>{grade}</option>))}
              </select>
              <button onClick={handleApplyFeedback}>Apply</button>
            </div>)}
        </div>)}
      {goal.subGoals && goal.subGoals.length > 0 && (<div>
          <h4>Sub-Goals:</h4>
          {goal.subGoals.map((subGoal) => (<GoalNodeDisplay key={subGoal.id} goal={subGoal} userId={userId} onGoalUpdated={onGoalUpdated} onGoalDeleted={onGoalDeleted}/>))}
        </div>)}
    </div>);
};
exports.default = GoalNodeDisplay;
