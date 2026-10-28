"""Builds compact data files for the app from the raw CSV.
Usage: python scripts/build_data.py "path/to/Airline Dataset Updated - v2.csv"
Outputs: public/data/cube.json (dashboard) and data/passengers.json (search API)."""
import sys, json
import pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else "Airline Dataset Updated - v2.csv"
df = pd.read_csv(src)
df.columns = [c.strip().replace(" ", "_").lower() for c in df.columns]

# Mixed date formats: M/D/YYYY (unambiguous) and DD-MM-YYYY (assumed day-first)
raw = df["departure_date"].astype(str)
dash = raw.str.contains("-")
dt = pd.to_datetime(raw.where(~dash), format="%m/%d/%Y")
dt[dash] = pd.to_datetime(raw[dash], format="%d-%m-%Y")
df["date"] = pd.to_datetime(dt)
df["arrival_airport"] = df["arrival_airport"].replace("0", "")
AGE = ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
df["age_group"] = pd.cut(df["age"], [0, 17, 24, 34, 44, 54, 64, 90], labels=AGE).astype(str)
df["month"] = df["date"].dt.month

STATUS = ["On Time", "Delayed", "Cancelled"]
CONT = sorted(df.continents.unique())
GEN = sorted(df.gender.unique())

# ---- cube: counts per continent x gender x age x month x status
cube = (df.assign(c=df.continents.map({v: i for i, v in enumerate(CONT)}),
                  g=df.gender.map({v: i for i, v in enumerate(GEN)}),
                  a=df.age_group.map({v: i for i, v in enumerate(AGE)}),
                  s=df.flight_status.map({v: i for i, v in enumerate(STATUS)}))
        .groupby(["c", "g", "a", "month", "s"]).size().reset_index(name="n"))
cube["month"] -= 1

daily = df.groupby([df.date.dt.strftime("%Y-%m-%d"), "flight_status"]).size().unstack(fill_value=0)[STATUS]
country = df.groupby(["country_name", "continents", "flight_status"]).size().unstack(fill_value=0)[STATUS].reset_index()
nat = df.groupby(["nationality", "flight_status"]).size().unstack(fill_value=0)[STATUS].reset_index()

out = {
    "meta": {"rows": len(df), "dateMin": str(df.date.min().date()), "dateMax": str(df.date.max().date()),
             "airports": int(df.airport_name.nunique()), "countries": int(df.country_name.nunique()),
             "nationalities": int(df.nationality.nunique()), "avgAge": round(float(df.age.mean()), 1)},
    "status": STATUS, "continents": CONT, "genders": GEN, "ageGroups": AGE,
    "cube": cube[["c", "g", "a", "month", "s", "n"]].values.tolist(),
    "daily": {"dates": daily.index.tolist(), "counts": daily.values.tolist()},
    "countries": [[r.country_name, r.continents, int(r[STATUS[0]]), int(r[STATUS[1]]), int(r[STATUS[2]])] for _, r in country.iterrows()],
    "nationalities": [[r.nationality, int(r[STATUS[0]]), int(r[STATUS[1]]), int(r[STATUS[2]])] for _, r in nat.iterrows()],
    "ageHist": df.age.value_counts().sort_index().reindex(range(1, 91), fill_value=0).tolist(),
}
json.dump(out, open("public/data/cube.json", "w"), separators=(",", ":"))


# ---- passengers (dictionary-encoded) for the search API
def enc(col):
    vals = sorted(df[col].unique())
    idx = {v: i for i, v in enumerate(vals)}
    return vals, df[col].map(idx).tolist()


dicts, cols = {}, {}
for k, col in [("nationality", "nationality"), ("airport", "airport_name"), ("country", "country_name"),
               ("continent", "continents"), ("arrival", "arrival_airport"), ("gender", "gender")]:
    dicts[k], cols[k] = enc(col)
rows = [[pid, f, l, int(a), d, p] for pid, f, l, a, d, p in zip(
    df.passenger_id, df.first_name, df.last_name, df.age, df.date.dt.strftime("%Y-%m-%d"), df.pilot_name)]
out2 = {"dicts": dicts, "status": STATUS, "base": rows,
        "g": cols["gender"], "nat": cols["nationality"], "ap": cols["airport"], "ct": cols["country"],
        "co": cols["continent"], "ar": cols["arrival"],
        "st": df.flight_status.map({v: i for i, v in enumerate(STATUS)}).tolist()}
json.dump(out2, open("data/passengers.json", "w"), separators=(",", ":"), ensure_ascii=False)
print("ok", len(df))
