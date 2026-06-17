export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_response_cache: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          prompt_hash: string;
          response: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          prompt_hash: string;
          response: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          prompt_hash?: string;
          response?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          session_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: string;
          session_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "chat_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_sessions: {
        Row: {
          created_at: string;
          guest_id: string | null;
          herb_context: string | null;
          id: string;
          messages: Json;
          title: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          guest_id?: string | null;
          herb_context?: string | null;
          id?: string;
          messages?: Json;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          guest_id?: string | null;
          herb_context?: string | null;
          id?: string;
          messages?: Json;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chat_sessions_herb_context_fkey";
            columns: ["herb_context"];
            isOneToOne: false;
            referencedRelation: "herbs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dosage_calculations: {
        Row: {
          adult_dose: string;
          calculated_dose: string;
          created_at: string;
          formula_used: Database["public"]["Enums"]["formula_type"];
          herb_id: string | null;
          id: string;
          notes: string | null;
          patient_age: number | null;
          patient_bsa: number | null;
          patient_height_cm: number | null;
          patient_weight_kg: number | null;
          user_id: string | null;
        };
        Insert: {
          adult_dose: string;
          calculated_dose: string;
          created_at?: string;
          formula_used: Database["public"]["Enums"]["formula_type"];
          herb_id?: string | null;
          id?: string;
          notes?: string | null;
          patient_age?: number | null;
          patient_bsa?: number | null;
          patient_height_cm?: number | null;
          patient_weight_kg?: number | null;
          user_id?: string | null;
        };
        Update: {
          adult_dose?: string;
          calculated_dose?: string;
          created_at?: string;
          formula_used?: Database["public"]["Enums"]["formula_type"];
          herb_id?: string | null;
          id?: string;
          notes?: string | null;
          patient_age?: number | null;
          patient_bsa?: number | null;
          patient_height_cm?: number | null;
          patient_weight_kg?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dosage_calculations_herb_id_fkey";
            columns: ["herb_id"];
            isOneToOne: false;
            referencedRelation: "herbs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dosage_calculations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      drug_interactions: {
        Row: {
          created_at: string;
          description: string;
          drug_name: string;
          evidence_level: string | null;
          herb_id: string;
          id: string;
          mechanism: string | null;
          rxcui: string | null;
          severity: Database["public"]["Enums"]["interaction_severity"];
          source: string | null;
          source_url: string | null;
          translations: Json | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          drug_name: string;
          evidence_level?: string | null;
          herb_id: string;
          id?: string;
          mechanism?: string | null;
          rxcui?: string | null;
          severity?: Database["public"]["Enums"]["interaction_severity"];
          source?: string | null;
          source_url?: string | null;
          translations?: Json | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          drug_name?: string;
          evidence_level?: string | null;
          herb_id?: string;
          id?: string;
          mechanism?: string | null;
          rxcui?: string | null;
          severity?: Database["public"]["Enums"]["interaction_severity"];
          source?: string | null;
          source_url?: string | null;
          translations?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drug_interactions_herb_id_fkey";
            columns: ["herb_id"];
            isOneToOne: false;
            referencedRelation: "herbs";
            referencedColumns: ["id"];
          },
        ];
      };
      herb_categories: {
        Row: {
          created_at: string;
          description: string | null;
          description_fr: string | null;
          icon: string | null;
          id: string;
          name: string;
          name_fr: string | null;
          slug: string;
          sort_order: number | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          description_fr?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          name_fr?: string | null;
          slug: string;
          sort_order?: number | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          description_fr?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          name_fr?: string | null;
          slug?: string;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      herb_monographs: {
        Row: {
          claims: Json;
          created_at: string;
          drug_interactions: Json;
          generation_method: string;
          herb_id: string;
          herb_slug: string;
          id: string;
          key_citations: Json;
          last_reviewed_at: string | null;
          mechanism: string;
          pregnancy_category: string;
          provenance: Json;
          reviewed_by: string | null;
          reviewer_credentials: string | null;
          safety_notes: Json;
          search_vector: unknown;
          status: string;
          summary: string;
          updated_at: string;
        };
        Insert: {
          claims?: Json;
          created_at?: string;
          drug_interactions?: Json;
          generation_method?: string;
          herb_id: string;
          herb_slug: string;
          id?: string;
          key_citations?: Json;
          last_reviewed_at?: string | null;
          mechanism: string;
          pregnancy_category: string;
          provenance?: Json;
          reviewed_by?: string | null;
          reviewer_credentials?: string | null;
          safety_notes?: Json;
          search_vector?: unknown;
          status?: string;
          summary: string;
          updated_at?: string;
        };
        Update: {
          claims?: Json;
          created_at?: string;
          drug_interactions?: Json;
          generation_method?: string;
          herb_id?: string;
          herb_slug?: string;
          id?: string;
          key_citations?: Json;
          last_reviewed_at?: string | null;
          mechanism?: string;
          pregnancy_category?: string;
          provenance?: Json;
          reviewed_by?: string | null;
          reviewer_credentials?: string | null;
          safety_notes?: Json;
          search_vector?: unknown;
          status?: string;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "herb_monographs_herb_id_fkey";
            columns: ["herb_id"];
            isOneToOne: false;
            referencedRelation: "herbs";
            referencedColumns: ["id"];
          },
        ];
      };
      herb_faqs: {
        Row: {
          answer: string;
          category: string;
          confidence_score: number | null;
          created_at: string;
          herb_id: string;
          id: string;
          is_featured: boolean | null;
          question: string;
          sort_order: number | null;
          source: string | null;
          updated_at: string;
        };
        Insert: {
          answer: string;
          category?: string;
          confidence_score?: number | null;
          created_at?: string;
          herb_id: string;
          id?: string;
          is_featured?: boolean | null;
          question: string;
          sort_order?: number | null;
          source?: string | null;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          category?: string;
          confidence_score?: number | null;
          created_at?: string;
          herb_id?: string;
          id?: string;
          is_featured?: boolean | null;
          question?: string;
          sort_order?: number | null;
          source?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "herb_faqs_herb_id_fkey";
            columns: ["herb_id"];
            isOneToOne: false;
            referencedRelation: "herbs";
            referencedColumns: ["id"];
          },
        ];
      };
      herbs: {
        Row: {
          active_compounds: string[] | null;
          category_id: string | null;
          citations: Json | null;
          common_names: string[] | null;
          contraindications: string[] | null;
          created_at: string;
          description: string;
          dosage_adult: string | null;
          dosage_child: string | null;
          dosage_forms: Database["public"]["Enums"]["dosage_form"][] | null;
          evidence_level: string | null;
          id: string;
          image_url: string | null;
          is_published: boolean | null;
          last_reviewed: string | null;
          modern_uses: string[] | null;
          name: string;
          nursing_safe: boolean | null;
          pregnancy_safe: boolean | null;
          preparation_notes: string | null;
          provenance: Json;
          pubchem_cid: string | null;
          reviewed_by: string | null;
          reviewer_credentials: string | null;
          scientific_name: string;
          side_effects: string[] | null;
          slug: string;
          symptom_keywords: string[] | null;
          traditional_uses: string[] | null;
          translations: Json | null;
          updated_at: string;
        };
        Insert: {
          active_compounds?: string[] | null;
          category_id?: string | null;
          citations?: Json | null;
          common_names?: string[] | null;
          contraindications?: string[] | null;
          created_at?: string;
          description: string;
          dosage_adult?: string | null;
          dosage_child?: string | null;
          dosage_forms?: Database["public"]["Enums"]["dosage_form"][] | null;
          evidence_level?: string | null;
          id?: string;
          image_url?: string | null;
          is_published?: boolean | null;
          last_reviewed?: string | null;
          modern_uses?: string[] | null;
          name: string;
          nursing_safe?: boolean | null;
          pregnancy_safe?: boolean | null;
          preparation_notes?: string | null;
          provenance?: Json;
          pubchem_cid?: string | null;
          reviewed_by?: string | null;
          reviewer_credentials?: string | null;
          scientific_name: string;
          side_effects?: string[] | null;
          slug: string;
          symptom_keywords?: string[] | null;
          traditional_uses?: string[] | null;
          translations?: Json | null;
          updated_at?: string;
        };
        Update: {
          active_compounds?: string[] | null;
          category_id?: string | null;
          citations?: Json | null;
          common_names?: string[] | null;
          contraindications?: string[] | null;
          created_at?: string;
          description?: string;
          dosage_adult?: string | null;
          dosage_child?: string | null;
          dosage_forms?: Database["public"]["Enums"]["dosage_form"][] | null;
          evidence_level?: string | null;
          id?: string;
          image_url?: string | null;
          is_published?: boolean | null;
          last_reviewed?: string | null;
          modern_uses?: string[] | null;
          name?: string;
          nursing_safe?: boolean | null;
          pregnancy_safe?: boolean | null;
          preparation_notes?: string | null;
          provenance?: Json;
          pubchem_cid?: string | null;
          reviewed_by?: string | null;
          reviewer_credentials?: string | null;
          scientific_name?: string;
          side_effects?: string[] | null;
          slug?: string;
          symptom_keywords?: string[] | null;
          traditional_uses?: string[] | null;
          translations?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "herbs_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "herb_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      interaction_checks: {
        Row: {
          created_at: string;
          herb_id: string | null;
          id: string;
          medications_checked: Json;
          results: Json;
          severity_summary:
            | Database["public"]["Enums"]["interaction_severity"]
            | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          herb_id?: string | null;
          id?: string;
          medications_checked?: Json;
          results?: Json;
          severity_summary?:
            | Database["public"]["Enums"]["interaction_severity"]
            | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          herb_id?: string | null;
          id?: string;
          medications_checked?: Json;
          results?: Json;
          severity_summary?:
            | Database["public"]["Enums"]["interaction_severity"]
            | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "interaction_checks_herb_id_fkey";
            columns: ["herb_id"];
            isOneToOne: false;
            referencedRelation: "herbs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interaction_checks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_profiles: {
        Row: {
          age_months: number | null;
          age_years: number | null;
          created_at: string | null;
          height_cm: number | null;
          id: string;
          is_default: boolean | null;
          name: string;
          notes: string | null;
          relationship: string;
          updated_at: string | null;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          age_months?: number | null;
          age_years?: number | null;
          created_at?: string | null;
          height_cm?: number | null;
          id?: string;
          is_default?: boolean | null;
          name: string;
          notes?: string | null;
          relationship?: string;
          updated_at?: string | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          age_months?: number | null;
          age_years?: number | null;
          created_at?: string | null;
          height_cm?: number | null;
          id?: string;
          is_default?: boolean | null;
          name?: string;
          notes?: string | null;
          relationship?: string;
          updated_at?: string | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_medications: {
        Row: {
          created_at: string;
          dosage: string | null;
          drug_name: string;
          frequency: string | null;
          id: string;
          is_active: boolean | null;
          notes: string | null;
          rxcui: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          dosage?: string | null;
          drug_name: string;
          frequency?: string | null;
          id?: string;
          is_active?: boolean | null;
          notes?: string | null;
          rxcui?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dosage?: string | null;
          drug_name?: string;
          frequency?: string | null;
          id?: string;
          is_active?: boolean | null;
          notes?: string | null;
          rxcui?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_medications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_guest_chat_message: {
        Args: {
          p_content: string;
          p_guest_id: string;
          p_role: string;
          p_session_id: string;
        };
        Returns: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          session_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "chat_messages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_guest_chat_session: {
        Args: { p_guest_id: string; p_herb_context?: string };
        Returns: {
          created_at: string;
          guest_id: string | null;
          herb_context: string | null;
          id: string;
          messages: Json;
          title: string | null;
          updated_at: string;
          user_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "chat_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_guest_chat_session: {
        Args: { p_guest_id: string; p_session_id: string };
        Returns: boolean;
      };
      get_guest_chat_messages: {
        Args: { p_session_id: string };
        Returns: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          session_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "chat_messages";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_guest_chat_sessions: {
        Args: { p_guest_id: string };
        Returns: {
          created_at: string;
          guest_id: string | null;
          herb_context: string | null;
          id: string;
          messages: Json;
          title: string | null;
          updated_at: string;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "chat_sessions";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      is_admin: { Args: never; Returns: boolean };
      search_herbs_by_symptom: {
        Args: { search_term: string };
        Returns: {
          active_compounds: string[] | null;
          category_id: string | null;
          citations: Json | null;
          common_names: string[] | null;
          contraindications: string[] | null;
          created_at: string;
          description: string;
          dosage_adult: string | null;
          dosage_child: string | null;
          dosage_forms: Database["public"]["Enums"]["dosage_form"][] | null;
          evidence_level: string | null;
          id: string;
          image_url: string | null;
          is_published: boolean | null;
          last_reviewed: string | null;
          modern_uses: string[] | null;
          name: string;
          nursing_safe: boolean | null;
          pregnancy_safe: boolean | null;
          preparation_notes: string | null;
          pubchem_cid: string | null;
          reviewed_by: string | null;
          reviewer_credentials: string | null;
          scientific_name: string;
          side_effects: string[] | null;
          slug: string;
          symptom_keywords: string[] | null;
          traditional_uses: string[] | null;
          translations: Json | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "herbs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      dosage_form:
        | "capsule"
        | "tablet"
        | "tincture"
        | "tea"
        | "powder"
        | "essential_oil"
        | "extract"
        | "topical"
        | "other";
      formula_type: "clarks_rule" | "youngs_rule" | "bsa" | "fried_rule";
      interaction_severity: "mild" | "moderate" | "severe" | "contraindicated";
      user_role: "user" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      dosage_form: [
        "capsule",
        "tablet",
        "tincture",
        "tea",
        "powder",
        "essential_oil",
        "extract",
        "topical",
        "other",
      ],
      formula_type: ["clarks_rule", "youngs_rule", "bsa", "fried_rule"],
      interaction_severity: ["mild", "moderate", "severe", "contraindicated"],
      user_role: ["user", "admin"],
    },
  },
} as const;
