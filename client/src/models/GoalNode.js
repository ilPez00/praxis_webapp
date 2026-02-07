"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWeightFromGrade = updateWeightFromGrade;
const FeedbackGrade_1 = require("./FeedbackGrade");
function updateWeightFromGrade(goalNode, grade) {
    let newWeight = goalNode.weight;
    switch (grade) {
        case FeedbackGrade_1.FeedbackGrade.SUCCEEDED:
            newWeight *= 0.8; // Easier
            break;
        case FeedbackGrade_1.FeedbackGrade.DISTRACTED:
            newWeight *= 1.2; // Harder
            break;
        case FeedbackGrade_1.FeedbackGrade.LEARNED:
            newWeight *= 0.9; // Slightly easier due to new understanding
            break;
        case FeedbackGrade_1.FeedbackGrade.ADAPTED:
            newWeight *= 1.05; // Slightly harder due to adaptation
            break;
        case FeedbackGrade_1.FeedbackGrade.NOT_APPLICABLE:
            // No change
            break;
    }
    return Object.assign(Object.assign({}, goalNode), { weight: newWeight });
}
