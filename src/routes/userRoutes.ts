import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  getUserGoals,
  addGoalToUser,
  updateUserGoal,
  deleteUserGoal,
  getUserMatches,      // Import new function
  computeUserMatches,  // Import new function
} from '../controllers/userController';

const router = Router();

router.get('/:id', getUserProfile);
router.put('/:id', updateUserProfile);

router.get('/:id/goals', getUserGoals);
router.post('/:id/goals', addGoalToUser);
router.put('/:id/goals/:goalId', updateUserGoal);
router.delete('/:id/goals/:goalId', deleteUserGoal);

router.get('/:id/matches', getUserMatches);             // New route
router.post('/:id/matches/compute', computeUserMatches); // New route

export default router;
