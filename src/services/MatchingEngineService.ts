import { User } from '../models/User';
import { GoalNode } from '../models/GoalNode';
import { Match } from '../models/Match';
import { Domain } from '../models/Domain';
import { mockDatabase } from './MockDatabase';
import { v4 as uuidv4 } from 'uuid';

class MatchingEngineService {

  // Helper to get all goal nodes from a user's goal tree recursively
  private getAllGoalNodes(goalTree: GoalNode[]): GoalNode[] {
    let allNodes: GoalNode[] = [];
    goalTree.forEach(node => {
      allNodes.push(node);
      if (node.subGoals && node.subGoals.length > 0) {
        allNodes = allNodes.concat(this.getAllGoalNodes(node.subGoals));
      }
    });
    return allNodes;
  }

  // Simplified similarity function for MVP
  private computeSimilarity(nodeA: GoalNode, nodeB: GoalNode): number {
    // For simplicity, just return 1 if names match, else 0
    // In a real app, this would be more sophisticated (e.g., semantic similarity)
    return nodeA.name === nodeB.name ? 1 : 0;
  }

  // Implementation of the SAB algorithm from ARCHITECTURE.md
  computeSABScore(userA: User, userB: User): number {
    let totalScore = 0.0;
    let sumWeightsA = 0.0;
    let sumWeightsB = 0.0;

    const userAGoals = this.getAllGoalNodes(userA.goalTree);
    const userBGoals = this.getAllGoalNodes(userB.goalTree);

    if (userAGoals.length === 0 || userBGoals.length === 0) {
      return 0; // Cannot compute score if either user has no goals
    }

    userAGoals.forEach(nodeA => sumWeightsA += nodeA.weight);
    userBGoals.forEach(nodeB => sumWeightsB += nodeB.weight);

    for (const nodeA of userAGoals) {
      for (const nodeB of userBGoals) {
        // δ = 1 if domains match, 0 otherwise
        const domainMatch = nodeA.domain === nodeB.domain ? 1 : 0;
        
        // sim(i, j) = progress similarity (0-1) - simplified
        const similarity = this.computeSimilarity(nodeA, nodeB); 
        
        // Wi, Wj = goal weights
        totalScore += domainMatch * similarity * nodeA.weight * nodeB.weight;
      }
    }

    // Normalize
    const denominator = sumWeightsA * sumWeightsB;
    if (denominator === 0) return 0; // Avoid division by zero

    return totalScore / denominator;
  }

  findMatches(userA: User): Match[] {
    const allUsers = mockDatabase.getUsers();
    const potentialMatches: Match[] = [];

    for (const userB of allUsers) {
      if (userA.id === userB.id) continue; // Don't match user with themselves

      const score = this.computeSABScore(userA, userB);

      if (score > 0) { // Only consider matches with a positive score
        const sharedGoals: string[] = [];
        const userAGoals = this.getAllGoalNodes(userA.goalTree);
        const userBGoals = this.getAllGoalNodes(userB.goalTree);

        // Find shared goals (simplified for MVP: just by name and domain)
        for (const nodeA of userAGoals) {
          for (const nodeB of userBGoals) {
            if (nodeA.domain === nodeB.domain && nodeA.name === nodeB.name) {
              sharedGoals.push(nodeB.id); // Add id of the shared goal from userB
            }
          }
        }
        potentialMatches.push({ userId: userB.id, score, sharedGoals: [...new Set(sharedGoals)] });
      }
    }
    
    // Sort by score in descending order
    potentialMatches.sort((a, b) => b.score - a.score);

    // Save matches to mockDatabase (for future retrieval) - simplified, overwrites
    // In a real app, this would be more persistent and not just for one user
    // mockDatabase.saveMatch(potentialMatches.map(match => ({ userId: userA.id, matches: potentialMatches })));

    return potentialMatches;
  }
}

export const matchingEngineService = new MatchingEngineService();
