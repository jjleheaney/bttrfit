/**
 * Hand-maintained mirror of `supabase/migrations`.
 *
 * Regenerate with:
 *   npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > lib/data/supabase/database.types.ts
 */

export type UnitPreference = "kg" | "lbs";
export type BlockStatus = "active" | "completed" | "abandoned";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          email: string;
          unit_preference: UnitPreference;
          created_at: string;
        };
        Insert: {
          id: string;
          first_name?: string;
          email?: string;
          unit_preference?: UnitPreference;
          created_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          email?: string;
          unit_preference?: UnitPreference;
          created_at?: string;
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          id: string;
          user_id: string;
          block_number: number;
          start_date: string;
          end_date: string;
          starting_weight: number;
          protein_target_g: number;
          weekly_drinks_target: number;
          status: BlockStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          block_number: number;
          start_date: string;
          starting_weight: number;
          protein_target_g: number;
          weekly_drinks_target?: number;
          status?: BlockStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          block_number?: number;
          start_date?: string;
          starting_weight?: number;
          protein_target_g?: number;
          weekly_drinks_target?: number;
          status?: BlockStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_entries: {
        Row: {
          id: string;
          user_id: string;
          block_id: string;
          entry_date: string;
          weight: number | null;
          protein_hit: boolean | null;
          workout_done: boolean | null;
          sleep_hit: boolean | null;
          steps_hit: boolean | null;
          drinks: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          block_id: string;
          entry_date: string;
          weight?: number | null;
          protein_hit?: boolean | null;
          workout_done?: boolean | null;
          sleep_hit?: boolean | null;
          steps_hit?: boolean | null;
          drinks?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          block_id?: string;
          entry_date?: string;
          weight?: number | null;
          protein_hit?: boolean | null;
          workout_done?: boolean | null;
          sleep_hit?: boolean | null;
          steps_hit?: boolean | null;
          drinks?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_entries_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      sentinel_lifts: {
        Row: {
          id: string;
          block_id: string;
          slot: number;
          lift_key: string;
          display_name: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          slot: number;
          lift_key: string;
          display_name: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          slot?: number;
          lift_key?: string;
          display_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sentinel_lifts_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      lift_entries: {
        Row: {
          id: string;
          sentinel_lift_id: string;
          week_number: number;
          reps: number;
          weight: number;
          logged_at: string;
        };
        Insert: {
          id?: string;
          sentinel_lift_id: string;
          week_number: number;
          reps: number;
          weight: number;
          logged_at?: string;
        };
        Update: {
          id?: string;
          sentinel_lift_id?: string;
          week_number?: number;
          reps?: number;
          weight?: number;
          logged_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lift_entries_sentinel_lift_id_fkey";
            columns: ["sentinel_lift_id"];
            isOneToOne: false;
            referencedRelation: "sentinel_lifts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_block: {
        Args: {
          p_first_name: string;
          p_unit_preference: UnitPreference;
          p_start_date: string;
          p_starting_weight: number;
          p_protein_target_g: number;
          p_weekly_drinks_target: number;
          // Each element is { slot, lift_key, display_name, reps, weight }.
          p_lifts: {
            slot: number;
            lift_key: string;
            display_name: string;
            reps: number;
            weight: number;
          }[];
        };
        Returns: Database["public"]["Tables"]["blocks"]["Row"];
      };
      delete_account: {
        Args: Record<never, never>;
        Returns: void;
      };
    };
    Enums: {
      unit_preference: UnitPreference;
      block_status: BlockStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};
