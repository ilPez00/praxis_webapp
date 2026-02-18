/**
 * @enum FeedbackGrade
 * @description Defines the possible grades for peer feedback on goal-related tasks.
 * These grades directly influence the recalibration of goal weights in the user's Goal Tree.
 */
export enum FeedbackGrade {
  /** The interaction partner successfully completed the task. */
  SUCCEEDED = 'Succeeded',
  /** The partner attempted the task but failed to complete it. */
  TRIED_BUT_FAILED = 'Tried but failed',
  /** The partner's performance was average or mediocre. */
  MEDIOCRE = 'Mediocre',
  /** The partner was distracted or lacked focus during the task. */
  DISTRACTED = 'Distracted',
  /** The partner is a complete beginner or demonstrated no competence. */
  TOTAL_NOOB = 'Total noob',
  /** Significant learning or growth was observed. */
  LEARNED = 'Learned',
  /** The partner successfully adapted their strategy to changing circumstances. */
  ADAPTED = 'Adapted',
  /** Feedback is not relevant to the current interaction. */
  NOT_APPLICABLE = 'Not Applicable',
}