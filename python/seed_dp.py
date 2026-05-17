#!/usr/bin/env python3
"""
BVETTER — Database Seeder (FIXED)
File: python/seed_db.py

Run from project root:
  py python/seed_db.py
"""

import openpyxl
import pymysql
from pathlib import Path

EXCEL_PATH = Path(__file__).parent.parent / 'BaliwagVet_2023-2025.xlsx'

DB = dict(
    host     = 'localhost',
    user     = 'root',
    password = 'root',       # change if your password is different
    database = 'vbetter',    # your database name
    charset  = 'utf8mb4',
)

BARANGAY_COORDS = {
    1:(14.9565,120.8959), 2:(14.9538,120.8942), 3:(14.9555,120.8975),
    4:(14.9580,120.8920), 5:(14.9520,120.8990), 6:(14.9502,120.8935),
    7:(14.9590,120.9005), 8:(14.9515,120.8910), 9:(14.9545,120.9020),
    10:(14.9498,120.8965),11:(14.9572,120.8948),12:(14.9530,120.8978),
    13:(14.9560,120.9010),14:(14.9508,120.8925),15:(14.9585,120.8940),
    16:(14.9522,120.9000),17:(14.9550,120.8915),18:(14.9535,120.8955),
    19:(14.9562,120.8930),20:(14.9518,120.8985),21:(14.9578,120.8968),
    22:(14.9505,120.8942),23:(14.9542,120.9015),24:(14.9570,120.8995),
    25:(14.9528,120.8920),26:(14.9555,120.8960),27:(14.9512,120.8975),
}


# ── Helper: safely convert to int, return None if invalid ──
def safe_int(val):
    try:
        if val is None:
            return None
        s = str(val).strip()
        if not s or s.upper() in ('TOTAL', 'NONE', 'N/A', '#N/A'):
            return None
        if s.startswith('='):   # Excel formula like =SUM(...)
            return None
        return int(float(s))    # float first handles "12.0" → 12
    except (ValueError, TypeError):
        return None


# ── Helper: safely convert to float ──
def safe_float(val):
    try:
        if val is None:
            return None
        s = str(val).strip()
        if not s or s.upper() in ('TOTAL', 'NONE', 'N/A', '#N/A'):
            return None
        if s.startswith('='):
            return None
        return float(s)
    except (ValueError, TypeError):
        return None


# ── Helper: check if a row is a real data row (not totals/headers) ──
def is_valid_month_row(r, month_key='month_no'):
    val = safe_int(r.get(month_key))
    return val is not None and 1 <= val <= 12


def get_sheet_data(wb, sheet_name: str):
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h).strip() if h else f'col_{i}' for i, h in enumerate(rows[2])]
    data = []
    for row in rows[3:]:
        if any(v is not None for v in row):
            data.append(dict(zip(headers, row)))
    return headers, data


def create_tables(conn):
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS barangay_masterlist (
        barangay_id                   INT PRIMARY KEY,
        barangay                      VARCHAR(100),
        estimated_dog_population_2025 INT,
        allocation_weight             FLOAT,
        risk_volume_group             VARCHAR(100),
        lat                           FLOAT,
        lng                           FLOAT
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS monthly_rabies (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        month_no              INT,
        month                 VARCHAR(20),
        dogs_2023             INT, dogs_2024 INT, dogs_2025 INT, dogs_total_3y INT,
        cats_2023             INT, cats_2024 INT, cats_2025 INT, cats_total_3y INT,
        vaccinated_total_2023 INT, vaccinated_total_2024 INT, vaccinated_total_2025 INT,
        vaccinated_total_3y   INT,
        clients_2023          INT, clients_2024 INT, clients_2025 INT, clients_total_3y INT
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS monthly_dogcontrol (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        month_no             INT,
        month                VARCHAR(20),
        bite_animal_2023     INT, bite_animal_2024 INT, bite_animal_2025 INT, bite_animal_total_3y INT,
        bite_human_2023      INT, bite_human_2024  INT, bite_human_2025  INT, bite_human_total_3y  INT,
        impounded_2023       INT, impounded_2024   INT, impounded_2025   INT, impounded_total_3y   INT,
        euthanized_2023      INT, euthanized_2024  INT, euthanized_2025  INT, euthanized_total_3y  INT,
        released_2023        INT, released_2024    INT, released_2025    INT, released_total_3y    INT,
        castrated_2023       INT, castrated_2024   INT, castrated_2025   INT, castrated_total_3y   INT
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS barangay_disease (
        id                     INT AUTO_INCREMENT PRIMARY KEY,
        year                   INT,
        month_no               INT,
        month                  VARCHAR(20),
        barangay_id            INT,
        barangay               VARCHAR(100),
        skin_related_cases     INT,
        parasitic_cases        INT,
        respiratory_cases      INT,
        gastrointestinal_cases INT,
        other_cases            INT,
        total_cases            INT,
        dominant_case_group    VARCHAR(50),
        risk_score             FLOAT,
        risk_class             ENUM('Low','Medium','High'),
        INDEX idx_year_month (year, month_no),
        INDEX idx_barangay   (barangay_id)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS forecast_dogs (
        period VARCHAR(7) PRIMARY KEY,
        year INT, month_no INT, month VARCHAR(20),
        metric VARCHAR(50), value INT, granularity VARCHAR(20)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS forecast_cats (
        period VARCHAR(7) PRIMARY KEY,
        year INT, month_no INT, month VARCHAR(20),
        metric VARCHAR(50), value INT, granularity VARCHAR(20)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS forecast_clients (
        period VARCHAR(7) PRIMARY KEY,
        year INT, month_no INT, month VARCHAR(20),
        metric VARCHAR(50), value INT, granularity VARCHAR(20)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS consultations_monthly (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        month_no             INT,
        month                VARCHAR(20),
        total_cases_2023     INT, total_cases_2024 INT, total_cases_2025 INT,
        combined_total_cases INT,
        dog_cases_3y         INT,
        cat_cases_3y         INT,
        livestock_cases_3y   INT,
        top_diagnosis_3y     VARCHAR(100),
        top_barangay_3y      VARCHAR(100),
        system_use           VARCHAR(200)
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS forecast_results (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        metric          VARCHAR(20),
        period          VARCHAR(7),
        month           VARCHAR(20),
        predicted_value FLOAT,
        lower_bound     FLOAT,
        upper_bound     FLOAT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.commit()
    print("✓ Tables created")


def seed_barangay_masterlist(conn, wb):
    _, rows = get_sheet_data(wb, 'Barangay_Masterlist')
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE barangay_masterlist")
    count = 0
    for r in rows:
        bid = safe_int(r.get('barangay_id'))
        if bid is None:
            continue    # skip TOTAL and non-numeric rows
        lat, lng = BARANGAY_COORDS.get(bid, (14.9555, 120.8975))
        cur.execute("""
            INSERT INTO barangay_masterlist
            (barangay_id, barangay, estimated_dog_population_2025,
             allocation_weight, risk_volume_group, lat, lng)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (bid,
              r.get('barangay'),
              safe_int(r.get('estimated_dog_population_2025')),
              safe_float(r.get('allocation_weight')),
              r.get('risk_volume_group'),
              lat, lng))
        count += 1
    conn.commit()
    print(f"✓ barangay_masterlist — {count} rows")


def seed_monthly_rabies(conn, wb):
    _, rows = get_sheet_data(wb, 'Monthly_Total_Rabies_3Y')
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE monthly_rabies")
    count = 0
    for r in rows:
        if not is_valid_month_row(r):   # skip TOTAL rows and formula rows
            continue
        cur.execute("""
            INSERT INTO monthly_rabies
            (month_no, month,
             dogs_2023, dogs_2024, dogs_2025, dogs_total_3y,
             cats_2023, cats_2024, cats_2025, cats_total_3y,
             vaccinated_total_2023, vaccinated_total_2024, vaccinated_total_2025, vaccinated_total_3y,
             clients_2023, clients_2024, clients_2025, clients_total_3y)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (safe_int(r.get('month_no')), r.get('month'),
              safe_int(r.get('dogs_2023')),   safe_int(r.get('dogs_2024')),   safe_int(r.get('dogs_2025')),   safe_int(r.get('dogs_total_3y')),
              safe_int(r.get('cats_2023')),   safe_int(r.get('cats_2024')),   safe_int(r.get('cats_2025')),   safe_int(r.get('cats_total_3y')),
              safe_int(r.get('vaccinated_total_2023')), safe_int(r.get('vaccinated_total_2024')), safe_int(r.get('vaccinated_total_2025')), safe_int(r.get('vaccinated_total_3y')),
              safe_int(r.get('clients_2023')), safe_int(r.get('clients_2024')), safe_int(r.get('clients_2025')), safe_int(r.get('clients_total_3y'))))
        count += 1
    conn.commit()
    print(f"✓ monthly_rabies — {count} rows")


def seed_monthly_dogcontrol(conn, wb):
    _, rows = get_sheet_data(wb, 'Monthly_Total_DogControl_3Y')
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE monthly_dogcontrol")
    count = 0
    for r in rows:
        if not is_valid_month_row(r):
            continue
        cur.execute("""
            INSERT INTO monthly_dogcontrol
            (month_no, month,
             bite_animal_2023, bite_animal_2024, bite_animal_2025, bite_animal_total_3y,
             bite_human_2023,  bite_human_2024,  bite_human_2025,  bite_human_total_3y,
             impounded_2023,   impounded_2024,   impounded_2025,   impounded_total_3y,
             euthanized_2023,  euthanized_2024,  euthanized_2025,  euthanized_total_3y,
             released_2023,    released_2024,    released_2025,    released_total_3y,
             castrated_2023,   castrated_2024,   castrated_2025,   castrated_total_3y)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (safe_int(r.get('month_no')), r.get('month'),
              safe_int(r.get('bite_animal_2023')), safe_int(r.get('bite_animal_2024')), safe_int(r.get('bite_animal_2025')), safe_int(r.get('bite_animal_total_3y')),
              safe_int(r.get('bite_human_2023')),  safe_int(r.get('bite_human_2024')),  safe_int(r.get('bite_human_2025')),  safe_int(r.get('bite_human_total_3y')),
              safe_int(r.get('impounded_2023')),   safe_int(r.get('impounded_2024')),   safe_int(r.get('impounded_2025')),   safe_int(r.get('impounded_total_3y')),
              safe_int(r.get('euthanized_2023')),  safe_int(r.get('euthanized_2024')),  safe_int(r.get('euthanized_2025')),  safe_int(r.get('euthanized_total_3y')),
              safe_int(r.get('released_2023')),    safe_int(r.get('released_2024')),    safe_int(r.get('released_2025')),    safe_int(r.get('released_total_3y')),
              safe_int(r.get('castrated_2023')),   safe_int(r.get('castrated_2024')),   safe_int(r.get('castrated_2025')),   safe_int(r.get('castrated_total_3y'))))
        count += 1
    conn.commit()
    print(f"✓ monthly_dogcontrol — {count} rows")


def seed_barangay_disease(conn, wb):
    _, rows = get_sheet_data(wb, 'Barangay_Disease_Monthly')
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE barangay_disease")
    count = 0
    for r in rows:
        if safe_int(r.get('barangay_id')) is None:
            continue
        if not is_valid_month_row(r):
            continue
        cur.execute("""
            INSERT INTO barangay_disease
            (year, month_no, month, barangay_id, barangay,
             skin_related_cases, parasitic_cases, respiratory_cases,
             gastrointestinal_cases, other_cases, total_cases,
             dominant_case_group, risk_score, risk_class)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (safe_int(r.get('year')), safe_int(r.get('month_no')), r.get('month'),
              safe_int(r.get('barangay_id')), r.get('barangay'),
              safe_int(r.get('skin_related_cases')), safe_int(r.get('parasitic_cases')),
              safe_int(r.get('respiratory_cases')),  safe_int(r.get('gastrointestinal_cases')),
              safe_int(r.get('other_cases')),         safe_int(r.get('total_cases')),
              r.get('dominant_case_group'),
              safe_float(r.get('risk_score')),        r.get('risk_class')))
        count += 1
    conn.commit()
    print(f"✓ barangay_disease — {count} rows")


def seed_forecast_table(conn, wb, sheet_name: str, table_name: str):
    _, rows = get_sheet_data(wb, sheet_name)
    cur = conn.cursor()
    cur.execute(f"TRUNCATE TABLE {table_name}")
    count = 0
    for r in rows:
        period = r.get('period')
        if not period or str(period).startswith('='):
            continue
        cur.execute(f"""
            INSERT INTO {table_name}
            (period, year, month_no, month, metric, value, granularity)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (str(period),
              safe_int(r.get('year')),
              safe_int(r.get('month_no')),
              r.get('month'),
              r.get('metric'),
              safe_int(r.get('value')),
              r.get('granularity')))
        count += 1
    conn.commit()
    print(f"✓ {table_name} — {count} rows")


def seed_consultations(conn, wb):
    _, rows = get_sheet_data(wb, 'Consult_Monthly_Total_3Y')
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE consultations_monthly")
    count = 0
    for r in rows:
        if not is_valid_month_row(r):
            continue
        cur.execute("""
            INSERT INTO consultations_monthly
            (month_no, month,
             total_cases_2023, total_cases_2024, total_cases_2025,
             combined_total_cases, dog_cases_3y, cat_cases_3y, livestock_cases_3y,
             top_diagnosis_3y, top_barangay_3y, system_use)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (safe_int(r.get('month_no')), r.get('month'),
              safe_int(r.get('total_cases_2023')), safe_int(r.get('total_cases_2024')), safe_int(r.get('total_cases_2025')),
              safe_int(r.get('combined_total_cases')),
              safe_int(r.get('dog_cases_3y')), safe_int(r.get('cat_cases_3y')), safe_int(r.get('livestock_cases_3y')),
              r.get('top_diagnosis_3y'), r.get('top_barangay_3y'), r.get('system_use')))
        count += 1
    conn.commit()
    print(f"✓ consultations_monthly — {count} rows")


def main():
    print("BVETTER Database Seeder")
    print("=" * 40)

    if not EXCEL_PATH.exists():
        print(f"ERROR: Excel file not found at {EXCEL_PATH}")
        print("Place BaliwagVet_2023-2025.xlsx in the project root.")
        return

    print(f"Reading: {EXCEL_PATH}")
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)  # data_only=True reads values not formulas

    print(f"Connecting to MySQL: {DB['host']}/{DB['database']}")
    conn = pymysql.connect(**DB)

    create_tables(conn)
    seed_barangay_masterlist(conn, wb)
    seed_monthly_rabies(conn, wb)
    seed_monthly_dogcontrol(conn, wb)
    seed_barangay_disease(conn, wb)
    seed_forecast_table(conn, wb, 'Forecast_Input_Dogs_3Y',    'forecast_dogs')
    seed_forecast_table(conn, wb, 'Forecast_Input_Cats_3Y',    'forecast_cats')
    seed_forecast_table(conn, wb, 'Forecast_Input_Clients_3Y', 'forecast_clients')
    seed_consultations(conn, wb)

    conn.close()
    print("=" * 40)
    print("✓ Done! All tables populated.")


if __name__ == '__main__':
    main()