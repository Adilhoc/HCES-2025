#!/usr/bin/env python3
import csv
import gzip
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "Files"
DATA_DIR = ROOT / "food_data"

KEY_COLS = [
    "Survey_Name",
    "Year",
    "FSU_Serial_No",
    "Sector",
    "State",
    "NSS_Region",
    "District",
    "Stratum",
    "Sub_stratum",
    "Panel",
    "Sub_sample",
    "FOD_Sub_Region",
    "Sample_SU_No",
    "Sample_Sub_Division_No",
    "Second_Stage_Stratum_No",
    "Sample_Household_No",
]

STATE_NAMES = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "D&NH and Daman & Diu",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman & Nicobar Islands",
    "36": "Telangana",
    "37": "Ladakh",
}

CATEGORIES = [
    ("129", "cereals", "Cereals"),
    ("139", "cereal_substitutes", "Cereal substitutes"),
    ("159", "pulses", "Pulses and pulse products"),
    ("179", "salt_sugar", "Salt and sugar"),
    ("169", "milk", "Milk and milk products"),
    ("219", "vegetables", "Vegetables"),
    ("239", "fresh_fruits", "Fresh fruits"),
    ("249", "dry_fruits", "Dry fruits"),
    ("199", "egg_fish_meat", "Egg, fish and meat"),
    ("189", "edible_oil", "Edible oil"),
    ("269", "spices", "Spices"),
    ("279", "beverages", "Beverages"),
    ("289", "served_processed", "Served processed food"),
    ("299", "packaged_processed", "Packaged processed food"),
]

CATEGORY_BY_CODE = {code: {"slug": slug, "label": label} for code, slug, label in CATEGORIES}
CATEGORY_TOTAL_CODES = set(CATEGORY_BY_CODE)

ITEM_NAMES = {
    "001": "Coarse grains - PDS",
    "002": "Coarse grains - other sources",
    "055": "Jowar and products - PDS",
    "056": "Bajra and products - PDS",
    "057": "Maize and products - PDS",
    "058": "Barley and products - PDS",
    "059": "Ragi and products - PDS",
    "060": "Small millets and products - PDS",
    "061": "Rice - free",
    "062": "Wheat/atta - free",
    "070": "Coarse grains - free",
    "071": "Pulses - free",
    "072": "Gram - free",
    "101": "Rice - PDS",
    "102": "Rice - other sources",
    "103": "Chira",
    "105": "Muri",
    "106": "Other rice products",
    "107": "Wheat/atta - PDS",
    "108": "Wheat/atta - other sources",
    "110": "Maida",
    "111": "Suji/rawa",
    "112": "Vermicelli/sewai",
    "113": "Bread/bakery",
    "114": "Other wheat products",
    "115": "Jowar and products",
    "116": "Bajra and products",
    "117": "Maize and products",
    "118": "Barley and products",
    "120": "Small millets and products",
    "121": "Ragi and products",
    "122": "Other cereals and products",
    "129": "Cereals subtotal",
    "139": "Cereal substitutes",
    "140": "Arhar/tur",
    "141": "Gram - split",
    "142": "Gram - whole",
    "143": "Moong",
    "144": "Masur",
    "145": "Urd",
    "146": "Peas/chickpeas",
    "148": "Other pulses",
    "150": "Besan/gram products",
    "152": "Other pulse products",
    "158": "Pulses - PDS",
    "159": "Pulses and pulse products subtotal",
    "160": "Milk - liquid",
    "161": "Baby food",
    "162": "Milk - condensed/powder",
    "163": "Curd",
    "164": "Ghee",
    "165": "Butter",
    "166": "Ice cream",
    "167": "Other milk products",
    "169": "Milk and milk products subtotal",
    "179": "Salt and sugar subtotal",
    "189": "Edible oil subtotal",
    "199": "Egg, fish and meat subtotal",
    "219": "Vegetables subtotal",
    "239": "Fresh fruits subtotal",
    "249": "Dry fruits subtotal",
    "269": "Spices subtotal",
    "279": "Beverages subtotal",
    "289": "Served processed food subtotal",
    "299": "Packaged processed food subtotal",
}

RATION_CARD_TYPES = {
    "0": "No ration card",
    "1": "Antyodaya",
    "2": "Priority household",
    "3": "Other ration card",
    "4": "No card / not eligible",
    "5": "Card not known",
    "9": "Other / unknown",
}


def read_csv(path):
    with path.open(newline="", encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def key_for(row):
    return tuple(row.get(col, "") for col in KEY_COLS)


def num(value):
    if value in (None, ""):
        return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def yes_no(value):
    return "Yes" if str(value).strip() == "1" else "No"


def sector_label(code):
    return {"1": "Rural", "2": "Urban"}.get(str(code), "Unknown")


def hh_size_band(value):
    size = int(num(value))
    if size <= 0:
        return "Unknown"
    if size == 1:
        return "1"
    if size == 2:
        return "2"
    if size <= 4:
        return "3 to 4"
    if size <= 6:
        return "5 to 6"
    return "7+"


def exp_band(value):
    amount = num(value)
    if amount <= 0:
        return "Unknown"
    if amount < 5000:
        return "< Rs.5k"
    if amount < 10000:
        return "Rs.5k-10k"
    if amount < 20000:
        return "Rs.10k-20k"
    if amount < 40000:
        return "Rs.20k-40k"
    return "Rs.40k+"


def source_group(code):
    code = str(code).strip()
    return {
        "1": "Purchase",
        "2": "Home-produced",
        "3": "Purchase + home-produced",
        "4": "Free collection/gift",
        "5": "PDS/free ration",
        "6": "Purchase + PDS/gift",
        "7": "PDS/free ration",
        "9": "Other",
    }.get(code, "Not classified")


def detail_category(code):
    if code in CATEGORY_BY_CODE:
        return CATEGORY_BY_CODE[code]
    value = int(code) if str(code).isdigit() else -1
    if value in {1, 2, 55, 56, 57, 58, 59, 60, 61, 62, 70} or 101 <= value <= 122:
        return CATEGORY_BY_CODE["129"]
    if value == 139:
        return CATEGORY_BY_CODE["139"]
    if value in {71, 72} or 140 <= value <= 158:
        return CATEGORY_BY_CODE["159"]
    if 160 <= value <= 168:
        return CATEGORY_BY_CODE["169"]
    if 170 <= value <= 178:
        return CATEGORY_BY_CODE["179"]
    if 180 <= value <= 188:
        return CATEGORY_BY_CODE["189"]
    if 190 <= value <= 198:
        return CATEGORY_BY_CODE["199"]
    if 200 <= value <= 218:
        return CATEGORY_BY_CODE["219"]
    if 220 <= value <= 238:
        return CATEGORY_BY_CODE["239"]
    if 240 <= value <= 248:
        return CATEGORY_BY_CODE["249"]
    if 250 <= value <= 268:
        return CATEGORY_BY_CODE["269"]
    if 270 <= value <= 278:
        return CATEGORY_BY_CODE["279"]
    if 280 <= value <= 288:
        return CATEGORY_BY_CODE["289"]
    if 290 <= value <= 298:
        return CATEGORY_BY_CODE["299"]
    return {"slug": "other", "label": "Other food"}


def item_name(code):
    category = detail_category(code)["label"]
    return ITEM_NAMES.get(code, f"Item {code} ({category})")


def blank_category_values():
    return {slug: 0.0 for _, slug, _ in CATEGORIES}


def context_row(base):
    state_code = base.get("State", "")
    return {
        "hh_key": "|".join(base.get(col, "") for col in KEY_COLS),
        "state_code": state_code,
        "state": STATE_NAMES.get(state_code, f"State {state_code}" if state_code else "Unknown"),
        "sector_code": base.get("Sector", ""),
        "sector": sector_label(base.get("Sector", "")),
        "weight": num(base.get("Multiplier")) / 100.0,
        "household_size": 0,
        "household_size_band": "Unknown",
        "ration_card_type": "Unknown",
        "ration_any": "Unknown",
        "pds_rice": "No",
        "pds_wheat": "No",
        "pds_pulses": "No",
        "pds_oil": "No",
        "pds_food": "No",
        "online_food": "No",
        "online_groceries": "No",
        "online_milk": "No",
        "online_vegetables": "No",
        "online_fruits": "No",
        "online_meat": "No",
        "online_served_processed": "No",
        "online_packed_processed": "No",
        "ceremony": "Unknown",
        "meals_non_hh": 0,
        "monthly_exp": 0.0,
        "monthly_exp_band": "Unknown",
        "values": blank_category_values(),
        "out_home_total_value": 0.0,
    }


def load_context():
    contexts = {}

    level3 = RAW_DIR / "LEVEL - 03.csv"
    for row in read_csv(level3):
        key = key_for(row)
        ctx = context_row(row)
        size = int(num(row.get("HH_Size_FDQ")))
        ctx["household_size"] = size
        ctx["household_size_band"] = hh_size_band(size)
        ration_type = str(row.get("Ration_Card_Type", "")).strip()
        ctx["ration_card_type"] = RATION_CARD_TYPES.get(ration_type, f"Code {ration_type}" if ration_type else "Unknown")
        contexts[key] = ctx

    level4 = RAW_DIR / "LEVEL - 04 (Section 4_1).csv"
    for row in read_csv(level4):
        key = key_for(row)
        ctx = contexts.setdefault(key, context_row(row))
        ctx["ration_any"] = yes_no(row.get("Ration_Any_Item_Last_30_Days"))
        ctx["pds_rice"] = yes_no(row.get("Ration_Rice"))
        ctx["pds_wheat"] = yes_no(row.get("Ration_Wheat"))
        ctx["pds_pulses"] = yes_no(row.get("Ration_Pulses"))
        ctx["pds_oil"] = yes_no(row.get("Ration_Edible_Oil"))
        ctx["pds_food"] = "Yes" if any(
            ctx[col] == "Yes"
            for col in ["pds_rice", "pds_wheat", "pds_pulses", "pds_oil"]
        ) else "No"
        ctx["online_groceries"] = yes_no(row.get("Online_Groceries"))
        ctx["online_milk"] = yes_no(row.get("Online_Milk"))
        ctx["online_vegetables"] = yes_no(row.get("Online_Vegetables"))
        online_fruit = row.get("Online_Fresh_Fruits") == "1" or row.get("Online_Dry_Fruits") == "1"
        ctx["online_fruits"] = "Yes" if online_fruit else "No"
        ctx["online_meat"] = yes_no(row.get("Online_Egg_Fish_Meat"))
        ctx["online_served_processed"] = yes_no(row.get("Online_Served_Processed_Food"))
        ctx["online_packed_processed"] = yes_no(row.get("Online_Packed_Processed_Food"))
        any_online = any(
            ctx[col] == "Yes"
            for col in [
                "online_groceries",
                "online_milk",
                "online_vegetables",
                "online_fruits",
                "online_meat",
                "online_served_processed",
                "online_packed_processed",
            ]
        ) or row.get("Online_Other_Food_Items") == "1"
        ctx["online_food"] = "Yes" if any_online else "No"
        ctx["ceremony"] = yes_no(row.get("Ceremony_Performed_Last_30_Days"))
        ctx["meals_non_hh"] = int(num(row.get("Meals_Served_to_Non_HH_Members")))

    level15 = RAW_DIR / "LEVEL - 15 (Section 1_1, A2,B2  C2).csv"
    exp_totals = defaultdict(float)
    exp_counts = defaultdict(int)
    for row in read_csv(level15):
        amount = num(row.get("MONTHLY_CONSUMPTION_EXP"))
        if amount > 0:
            key = key_for(row)
            exp_totals[key] += amount
            exp_counts[key] += 1
    for key, total in exp_totals.items():
        ctx = contexts.get(key)
        if ctx:
            average = total / max(exp_counts[key], 1)
            ctx["monthly_exp"] = average
            ctx["monthly_exp_band"] = exp_band(average)

    return contexts


def cube_key(ctx, code, category, src_group):
    return (
        ctx["state_code"],
        ctx["state"],
        ctx["sector_code"],
        ctx["sector"],
        category["slug"],
        category["label"],
        code,
        item_name(code),
        src_group,
        ctx["ration_any"],
        ctx["pds_food"],
        ctx["online_food"],
        ctx["ceremony"],
        ctx["household_size_band"],
        ctx["monthly_exp_band"],
    )


def add_item(cube, ctx, code, src, value, quantity, out_home_value=0.0, out_home_qty=0.0):
    category = detail_category(code)
    key = cube_key(ctx, code, category, source_group(src))
    stats = cube[key]
    weight = ctx["weight"]
    stats["weighted_value"] += value * weight
    stats["weighted_quantity"] += quantity * weight
    stats["weighted_out_home_value"] += out_home_value * weight
    stats["weighted_out_home_quantity"] += out_home_qty * weight
    stats["row_count"] += 1


def process_food(contexts):
    cube = defaultdict(lambda: {
        "weighted_value": 0.0,
        "weighted_quantity": 0.0,
        "weighted_out_home_value": 0.0,
        "weighted_out_home_quantity": 0.0,
        "row_count": 0,
    })
    category_rows = 0
    detail_rows = 0
    missing_context = 0

    level5 = RAW_DIR / "LEVEL - 05 ( Sec 5  6).csv"
    for row in read_csv(level5):
        ctx = contexts.get(key_for(row))
        if not ctx:
            missing_context += 1
            continue
        code = row.get("Item_Code", "")
        # 30-day recall items: Cereals (129), Substitutes (139), Pulses (159), Salt/Sugar (179)
        # All other food items in Sections 5-7 are 7-day recall.
        multiplier_30 = 1.0 if code in {"129", "139", "159", "179"} else (30 / 7)
        value = num(row.get("Total_Consumption_Value")) * multiplier_30
        quantity = num(row.get("Total_Consumption_Quantity")) * multiplier_30
        out_value = num(row.get("OutOfHome_Consumption_Value")) * multiplier_30
        out_qty = num(row.get("OutOfHome_Consumption_Quantity")) * multiplier_30

        if code in CATEGORY_BY_CODE:
            slug = CATEGORY_BY_CODE[code]["slug"]
            ctx["values"][slug] += value
            ctx["out_home_total_value"] += out_value
            category_rows += 1
        else:
            add_item(cube, ctx, code, row.get("Source", ""), value, quantity, out_value, out_qty)
            detail_rows += 1

    level6 = RAW_DIR / "LEVEL - 06 (Section 7).csv"
    for row in read_csv(level6):
        ctx = contexts.get(key_for(row))
        if not ctx:
            missing_context += 1
            continue
        code = row.get("Item_Code", "")
        multiplier_30 = 1.0 if code in {"129", "139", "159", "179"} else (30 / 7)
        value = num(row.get("Total_Consumption_Value")) * multiplier_30
        quantity = num(row.get("Total_Consumption_Quantity")) * multiplier_30

        if code in CATEGORY_BY_CODE:
            slug = CATEGORY_BY_CODE[code]["slug"]
            ctx["values"][slug] += value
            category_rows += 1
        else:
            add_item(cube, ctx, code, row.get("Source", ""), value, quantity)
            detail_rows += 1

    return cube, {
        "category_rows_used": category_rows,
        "detail_rows_used": detail_rows,
        "rows_missing_household_context": missing_context,
    }


def write_households(contexts):
    out_path = DATA_DIR / "food_households.csv.gz"
    fields = [
        "hh_key",
        "state_code",
        "state",
        "sector_code",
        "sector",
        "weight",
        "household_size",
        "household_size_band",
        "ration_card_type",
        "ration_any",
        "pds_rice",
        "pds_wheat",
        "pds_pulses",
        "pds_oil",
        "pds_food",
        "online_food",
        "online_groceries",
        "online_milk",
        "online_vegetables",
        "online_fruits",
        "online_meat",
        "online_served_processed",
        "online_packed_processed",
        "ceremony",
        "meals_non_hh",
        "monthly_exp",
        "monthly_exp_band",
        "food_total_value",
        "out_home_total_value",
    ] + [f"val_{slug}" for _, slug, _ in CATEGORIES]

    with gzip.open(out_path, "wt", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for ctx in contexts.values():
            values = ctx["values"]
            food_total = sum(values.values())
            row = {field: ctx.get(field, "") for field in fields}
            row["food_total_value"] = round(food_total, 2)
            row["out_home_total_value"] = round(ctx["out_home_total_value"], 2)
            for _, slug, _ in CATEGORIES:
                row[f"val_{slug}"] = round(values[slug], 2)
            writer.writerow(row)
    return out_path


def write_cube(cube):
    out_path = DATA_DIR / "food_item_cube.csv.gz"
    fields = [
        "state_code",
        "state",
        "sector_code",
        "sector",
        "category_slug",
        "category",
        "item_code",
        "item_name",
        "source_group",
        "ration_any",
        "pds_food",
        "online_food",
        "ceremony",
        "household_size_band",
        "monthly_exp_band",
        "weighted_value",
        "weighted_quantity",
        "weighted_out_home_value",
        "weighted_out_home_quantity",
        "row_count",
    ]
    with gzip.open(out_path, "wt", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for key, stats in cube.items():
            row = dict(zip(fields[:15], key))
            for stat_key in fields[15:19]:
                row[stat_key] = round(stats[stat_key], 2)
            row["row_count"] = stats["row_count"]
            writer.writerow(row)
    return out_path


def write_metadata(contexts, cube, process_stats):
    categories = [
        {
            "code": code,
            "slug": slug,
            "label": label,
            "column": f"val_{slug}",
        }
        for code, slug, label in CATEGORIES
    ]
    item_codes = sorted({key[6] for key in cube})
    item_map = {
        "categories": categories,
        "items": [
            {
                "code": code,
                "name": item_name(code),
                "category": detail_category(code)["label"],
                "category_slug": detail_category(code)["slug"],
                "is_category_subtotal": code in CATEGORY_TOTAL_CODES,
            }
            for code in item_codes
        ],
        "source_groups": [
            "Purchase",
            "Home-produced",
            "Purchase + home-produced",
            "Free collection/gift",
            "PDS/free ration",
            "Purchase + PDS/gift",
            "Other",
            "Not classified",
        ],
    }
    (DATA_DIR / "item_map.json").write_text(json.dumps(item_map, indent=2), encoding="utf-8")

    weighted_households = sum(ctx["weight"] for ctx in contexts.values())
    food_weighted_value = 0.0
    out_home_weighted_value = 0.0
    for ctx in contexts.values():
        weight = ctx["weight"]
        food_weighted_value += sum(ctx["values"].values()) * weight
        out_home_weighted_value += ctx["out_home_total_value"] * weight

    summary = {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "raw_source_folder": "Files",
        "households": len(contexts),
        "weighted_households": weighted_households,
        "food_weighted_value": food_weighted_value,
        "out_home_weighted_value_sections_5_6": out_home_weighted_value,
        "item_cube_rows": len(cube),
        "category_count": len(categories),
        "detail_item_count": len(item_codes),
        "notes": [
            "Food category values use HCES subtotal item codes from Sections 5, 6 and 7 to avoid double-counting detailed item rows.",
            "Item ranking/source views use detailed item rows and exclude category subtotal rows.",
            "Questionnaire_No and Level are excluded from the household join key because modules use different questionnaire identifiers.",
            "Total_Consumption_Value is consumption value. It may include imputed values for non-market sources, not only cash purchases.",
        ],
        **process_stats,
    }
    (DATA_DIR / "food_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


def main():
    DATA_DIR.mkdir(exist_ok=True)
    print("Loading household context...")
    contexts = load_context()
    print(f"Loaded {len(contexts):,} households")
    print("Processing food consumption records...")
    cube, process_stats = process_food(contexts)
    print(f"Built item cube with {len(cube):,} rows")
    print("Writing compressed dashboard data...")
    household_path = write_households(contexts)
    cube_path = write_cube(cube)
    write_metadata(contexts, cube, process_stats)
    print(f"Wrote {household_path.relative_to(ROOT)}")
    print(f"Wrote {cube_path.relative_to(ROOT)}")
    print("Done")


if __name__ == "__main__":
    main()
