import type { Recipe } from "../types";
export function publishRecipeRevision(recipes: Recipe[], source: Recipe, changes: Partial<Recipe>, id: string, now = new Date()): Recipe {
  const lineageId = source.lineageId ?? source.id;
  const version = Math.max(...recipes.filter(recipe => (recipe.lineageId ?? recipe.id) === lineageId).map(recipe => recipe.version)) + 1;
  return {
    ...source, ...changes, id, lineageId, version, createdAt: now.toISOString(), retiredAt: undefined,
    conditions: (changes.conditions ?? source.conditions).map(condition => ({ ...condition, lineageId: condition.lineageId ?? condition.id, id: `${id}:${condition.lineageId ?? condition.id}` })),
  };
}
