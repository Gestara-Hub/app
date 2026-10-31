// Gerado por `pnpm world:schema` (scripts/gen-world-schema.mjs). Nao editar a mao.

export interface WorldColumn {
  type: string;
  nullable: boolean;
  hasDefault: boolean;
}

export interface WorldTableSchema {
  primaryKey: string;
  columns: Record<string, WorldColumn>;
}

export const WORLD_SCHEMA: Record<string, WorldTableSchema> = {
  "assessments": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "class_group_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "modality_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "date": {
        "type": "date",
        "nullable": false,
        "hasDefault": false
      },
      "weight": {
        "type": "numeric",
        "nullable": false,
        "hasDefault": true
      },
      "level_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "grades": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "attendances": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "session_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "student_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "marked_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "audit_logs": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "uuid",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "unit_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "timestamp": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "actor": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": false
      },
      "action": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "target": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": false
      },
      "summary": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "changes": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "security": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "source": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "failed": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "error_reference": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      }
    }
  },
  "categories": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "position": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "progression_track": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "assessments": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "charges": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "unit_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "student_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "kind": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "plan_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "class_group_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "competence": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "period_start": {
        "type": "date",
        "nullable": true,
        "hasDefault": false
      },
      "period_end": {
        "type": "date",
        "nullable": true,
        "hasDefault": false
      },
      "session_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "due_date": {
        "type": "date",
        "nullable": false,
        "hasDefault": false
      },
      "amount_cents": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "paid_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "method": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "paid_via": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "attachments": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "canceled_by": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "cancel_reason": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "replaced": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "scholarship_percent": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "list_amount_cents": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "description": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "installment_group_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "enrollment_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "student_package_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "cycle_index": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "cycle_total": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "is_prorated": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "prorated_days": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "notes": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "class_groups": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "unit_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "modality_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "instructor_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "enrollment_type": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "capacity": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "plan_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "allow_dropin": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "session_price_cents": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "meeting_slots": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "start_date": {
        "type": "date",
        "nullable": false,
        "hasDefault": false
      },
      "end_date": {
        "type": "date",
        "nullable": true,
        "hasDefault": false
      },
      "billing_mode": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "course_price_cents": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "course_max_installments": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "schedule_history": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "class_reservations": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "class_group_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "session_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "student_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "kind": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "charge_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "reserved_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "class_session_overrides": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "session_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "instructor_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "reason": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "clients": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "phone": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "email": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "birth_date": {
        "type": "date",
        "nullable": true,
        "hasDefault": false
      },
      "guardians": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "notes": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "address": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "plan_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "plan_start_date": {
        "type": "date",
        "nullable": true,
        "hasDefault": false
      },
      "billing_strategy": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "cycle_payment_timing": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "due_day": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "discount": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "membership_status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "progressions": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "gateway_customer_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "minor_consent_status": {
        "type": "text",
        "nullable": true,
        "hasDefault": true
      },
      "minor_consent_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "minor_consent_by": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "minor_consent_evidence": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": true
      },
      "cpf": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "charges_from": {
        "type": "date",
        "nullable": true,
        "hasDefault": false
      }
    }
  },
  "enrollments": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "class_group_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "student_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "enrolled_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "canceled_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "cancellation_reason": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "course": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "pays_with_package": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "financial_categories": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "type": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "system": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "system_key": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "financial_entries": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "unit_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "type": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "category_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "description": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "amount_cents": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "due_date": {
        "type": "date",
        "nullable": false,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "paid_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "method": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "recurrence_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "recurrence_competence": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "notes": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "attachments": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "financial_recurrences": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "type": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "category_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "description": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "amount_cents": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "day_of_month": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "start_competence": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "end_competence": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "lesson_packages": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "lessons": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "price_cents": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "validity_days": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "class_group_ids": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "modality_ids": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "absence_consumes": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "message_logs": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "recipient_name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "recipient_phone": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "trigger": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "category": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "content": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "client_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "charge_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "sent_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "read_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "error_reason": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "message_templates": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "trigger": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "category": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "title": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "description": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "enabled": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "send_hour": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "days_offset": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "content": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "available_variables": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "online_payments": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "charge_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "client_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "method": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "amount_cents": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "split_amount_cents": {
        "type": "integer",
        "nullable": true,
        "hasDefault": true
      },
      "net_amount_cents": {
        "type": "integer",
        "nullable": true,
        "hasDefault": true
      },
      "gateway_provider": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "gateway_payment_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "pix_copy_paste": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "pix_qr_code_base64": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "link_url": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "expires_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": false
      },
      "paid_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "canceled_reason": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "fee_passed_to_customer": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "gateway_fee_cents": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "paid_method": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "gateway_cancel_pending": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "public_code": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "opened_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "credit_date": {
        "type": "date",
        "nullable": true,
        "hasDefault": false
      },
      "funds_released": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "receipt_url": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      }
    }
  },
  "organizations": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "segment": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "model": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "class_segment": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "custom_segment_name": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "custom_segment_progression": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "custom_segment_billing": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "settings": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "subscription": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "gateway_provider": {
        "type": "text",
        "nullable": true,
        "hasDefault": true
      },
      "gateway_account_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "gateway_wallet_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "gateway_status": {
        "type": "text",
        "nullable": true,
        "hasDefault": true
      },
      "gateway_api_key": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "gateway_fees": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "gateway_fees_synced_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "gateway_webhook_url": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "certificate_template": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      }
    }
  },
  "plans": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "price_cents": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "period": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "professionals": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "unit_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "role_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "phone": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "address": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "working_hours": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "service_ids": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "modality_ids": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "email": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      }
    }
  },
  "roles": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "position": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "student_packages": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "unit_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "student_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "package_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "lessons_total": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "lessons_used": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "purchased_at": {
        "type": "date",
        "nullable": false,
        "hasDefault": false
      },
      "expires_at": {
        "type": "date",
        "nullable": true,
        "hasDefault": false
      },
      "class_group_ids": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "modality_ids": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "absence_consumes": {
        "type": "boolean",
        "nullable": false,
        "hasDefault": true
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "carried_over_lessons": {
        "type": "integer",
        "nullable": true,
        "hasDefault": false
      },
      "carried_from": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "renewed_from_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "renewed_into_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "charge_ids": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "usages": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "teacher_pay_rules": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "professional_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "components": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "payment_day": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "start_competence": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "teacher_payouts": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "professional_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "competence": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "lines": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "total_cents": {
        "type": "integer",
        "nullable": false,
        "hasDefault": false
      },
      "due_date": {
        "type": "date",
        "nullable": false,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "closed_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "paid_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "method": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "attachments": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "counted_charge_ids": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "notes": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "units": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "address": {
        "type": "jsonb",
        "nullable": true,
        "hasDefault": false
      },
      "phone": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "business_hours": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "users": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "auth_user_id": {
        "type": "uuid",
        "nullable": true,
        "hasDefault": false
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "name": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "email": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "profile": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "professional_id": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "terms_accepted_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "terms_version": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      }
    }
  },
  "waitlist": {
    "primaryKey": "id",
    "columns": {
      "id": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "class_group_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "student_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "position": {
        "type": "integer",
        "nullable": false,
        "hasDefault": true
      },
      "status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "created_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  },
  "whatsapp_connections": {
    "primaryKey": "organization_id",
    "columns": {
      "organization_id": {
        "type": "text",
        "nullable": false,
        "hasDefault": false
      },
      "official_status": {
        "type": "text",
        "nullable": false,
        "hasDefault": true
      },
      "phone_number": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "display_name": {
        "type": "text",
        "nullable": true,
        "hasDefault": false
      },
      "connected_at": {
        "type": "timestamptz",
        "nullable": true,
        "hasDefault": false
      },
      "allowed_send_hours": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "monthly_quota": {
        "type": "jsonb",
        "nullable": false,
        "hasDefault": true
      },
      "updated_at": {
        "type": "timestamptz",
        "nullable": false,
        "hasDefault": true
      }
    }
  }
};
