import {
  goalCompletionRatio,
  type GoalProgress,
  type WalkGoal,
  type WalkedTotals,
} from "../../shared/goal"

export class GoalTracker {
  private goal: WalkGoal | null = null
  private goalReachedAt: number | null = null

  get reachedAt(): number | null {
    return this.goalReachedAt
  }

  setGoal(goal: WalkGoal | null): void {
    this.goal = goal
    this.goalReachedAt = null
  }

  progressOf(totals: WalkedTotals | undefined): GoalProgress | null {
    if (!this.goal) return null
    return {
      goal: this.goal,
      walkedMeters: totals?.distanceMeters ?? 0,
      walkedSeconds: totals?.durationSeconds ?? 0,
      reachedAt: this.goalReachedAt,
    }
  }

  recordProgress(totals: WalkedTotals | undefined, at: number): void {
    const progress = this.progressOf(totals)
    if (
      progress &&
      this.goalReachedAt === null &&
      goalCompletionRatio(progress) >= 1
    )
      this.goalReachedAt = at
  }
}
