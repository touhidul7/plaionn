export interface SkaterLeader {
  player_id: string;
  display_name: string;
  team_entry_id: string;
  team_name: string;
  jersey_number: number | null;
  player_position: string;
  games_played: number;
  goals: number;
  assists: number;
  points: number;
  penalty_minutes: number;
}

export interface GoalieLeader {
  player_id: string;
  display_name: string;
  team_entry_id: string;
  team_name: string;
  jersey_number: number | null;
  games_played: number;
  goals_against: number;
  goals_against_average: number;
  shutouts: number;
}

