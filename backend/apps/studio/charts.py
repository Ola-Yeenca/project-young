"""Server-rendered chart geometry for the Studio overview.

Follows the dataviz guidance: one dot per enquiry in a unit chart, two validated
series colours, a legend plus a table view so colour is never the only channel.
"""


def bars(rows, value_key="value", max_width=100):
    """Horizontal single-series bars as percentages of the largest value."""
    top = max((r[value_key] for r in rows), default=0) or 1
    return [{**r, "pct": round(r[value_key] / top * max_width, 1)} for r in rows]


def dot_matrix(days, min_rows=6, step=12, r=3.4, pad_bottom=22):
    """Unit chart: one dot per enquiry, stacked per day (bookings below messages).

    days: [{"date", "a", "b", "tip", "label"}]. Empty slots show as faint dots so the
    grid reads as a calendar even on quiet days.
    """
    rows = max(min_rows, max((d["a"] + d["b"] for d in days), default=0))
    width = len(days) * step
    height = rows * step + pad_bottom
    cols = []
    for i, d in enumerate(days):
        cx = i * step + step / 2
        dots = []
        for k in range(rows):
            cy = rows * step - k * step - step / 2
            kind = "a" if k < d["a"] else "b" if k < d["a"] + d["b"] else "bg"
            dots.append({"cx": cx, "cy": cy, "kind": kind})
        label = d["label"] if i <= len(days) - 4 else ""  # keep the last label inside the chart
        cols.append({**d, "label": label, "x": i * step, "cx": cx, "dots": dots})
    return {"width": width, "height": height, "cols": cols, "r": r, "step": step, "label_y": rows * step + 16}
