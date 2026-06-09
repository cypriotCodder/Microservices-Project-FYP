#!/usr/bin/env python3
"""
generate_charts.py — Dissertation-quality chart generator for k6 load test results.

Reads JSON summary files from ./results/ and produces 7 high-DPI PNG charts
in ./results/charts/.

Usage:
    cd performance
    python3 generate_charts.py

Dependencies: matplotlib (pip3 install matplotlib)
"""

import json
import os
import sys
import textwrap

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend — works without a display
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.patches import FancyBboxPatch
import matplotlib.patheffects as pe

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(SCRIPT_DIR, "results")
CHARTS_DIR = os.path.join(RESULTS_DIR, "charts")

# ─── Colour Palette ──────────────────────────────────────────────────────────
BG_COLOR = "#1a1a2e"
PANEL_COLOR = "#16213e"
TEXT_COLOR = "#e0e0e0"
GRID_COLOR = "#2a2a4a"
MICRO_COLOR = "#00b4d8"    # Teal
MONO_COLOR = "#ff6b6b"     # Coral
CHAOS_COLOR = "#ffd166"    # Yellow-gold
ACCENT_GREEN = "#06d6a0"
ACCENT_PURPLE = "#b388ff"
FLOOD_BG = "#2d1b4e"
DRAIN_BG = "#1b3a2d"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def load_json(filename):
    """Load a JSON file from the results directory. Returns None on failure."""
    path = os.path.join(RESULTS_DIR, filename)
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"  ⚠️  {filename} not found — skipping charts that need it.")
        return None
    except json.JSONDecodeError as e:
        print(f"  ⚠️  {filename} is invalid JSON: {e}")
        return None


def metric(data, key, stat):
    """Safely extract a metric stat from k6 JSON summary."""
    try:
        return data["metrics"][key][stat]
    except (KeyError, TypeError):
        return None


def fmt_ms(v):
    """Format a millisecond value for display."""
    if v is None:
        return "n/a"
    if v >= 1000:
        return f"{v/1000:.2f}s"
    return f"{v:.1f}ms"


def apply_dark_style(fig, axes):
    """Apply the dark academic style to a figure and its axes."""
    fig.patch.set_facecolor(BG_COLOR)
    if not isinstance(axes, (list, tuple)):
        axes = [axes]
    for ax in axes:
        ax.set_facecolor(PANEL_COLOR)
        ax.tick_params(colors=TEXT_COLOR, labelsize=9)
        ax.xaxis.label.set_color(TEXT_COLOR)
        ax.yaxis.label.set_color(TEXT_COLOR)
        ax.title.set_color(TEXT_COLOR)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_color(GRID_COLOR)
        ax.spines["bottom"].set_color(GRID_COLOR)
        ax.grid(axis="y", color=GRID_COLOR, linewidth=0.5, alpha=0.6)


def annotate_bars(ax, bars, fmt_func=fmt_ms, fontsize=7.5, offset=4):
    """Add value labels on top of bar chart bars."""
    for bar in bars:
        h = bar.get_height()
        if h > 0:
            label = fmt_func(h)
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                h + offset,
                label,
                ha="center", va="bottom",
                fontsize=fontsize, color=TEXT_COLOR, fontweight="bold",
                path_effects=[pe.withStroke(linewidth=2, foreground=PANEL_COLOR)],
            )


def save_chart(fig, filename):
    """Save a chart to the charts directory."""
    path = os.path.join(CHARTS_DIR, filename)
    fig.savefig(path, dpi=300, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  ✅  {filename}")


# ─── Chart Generators ────────────────────────────────────────────────────────

def chart_01_stress_latency(micro, mono):
    """Chart 1: Stress test latency comparison (500 VU)."""
    labels = ["Avg", "Median", "p90", "p95", "Max"]
    stats  = ["avg", "med", "p(90)", "p(95)", "max"]

    micro_key = "http_req_duration{arch:microservices}"
    mono_key  = "http_req_duration{arch:monolith}"

    micro_vals = [metric(micro, micro_key, s) or 0 for s in stats]
    mono_vals  = [metric(mono, mono_key, s) or 0 for s in stats]

    x = range(len(labels))
    width = 0.35

    fig, ax = plt.subplots(figsize=(10, 6))
    apply_dark_style(fig, ax)

    bars1 = ax.bar([i - width/2 for i in x], micro_vals, width, label="Microservices",
                   color=MICRO_COLOR, edgecolor="white", linewidth=0.5, zorder=3)
    bars2 = ax.bar([i + width/2 for i in x], mono_vals, width, label="Monolith",
                   color=MONO_COLOR, edgecolor="white", linewidth=0.5, zorder=3)

    annotate_bars(ax, bars1, offset=max(max(micro_vals), max(mono_vals)) * 0.01)
    annotate_bars(ax, bars2, offset=max(max(micro_vals), max(mono_vals)) * 0.01)

    ax.set_xlabel("Latency Percentile", fontsize=11, fontweight="bold")
    ax.set_ylabel("Response Time (ms)", fontsize=11, fontweight="bold")
    ax.set_title("Stress Test Latency — Microservices vs Monolith (500 VU)",
                 fontsize=13, fontweight="bold", pad=15)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=10)
    ax.legend(facecolor=PANEL_COLOR, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR, fontsize=10)

    save_chart(fig, "01_stress_latency_comparison.png")


def chart_02_throughput_errorrate(micro, mono):
    """Chart 2: Throughput & error rate (stress test)."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5.5))
    apply_dark_style(fig, [ax1, ax2])

    # Panel A — Throughput (req/s)
    micro_rps = metric(micro, "http_reqs", "rate") or 0
    mono_rps  = metric(mono, "http_reqs", "rate") or 0
    archs = ["Microservices", "Monolith"]
    colors = [MICRO_COLOR, MONO_COLOR]

    bars_a = ax1.bar(archs, [micro_rps, mono_rps], color=colors,
                     edgecolor="white", linewidth=0.5, width=0.5, zorder=3)
    annotate_bars(ax1, bars_a, fmt_func=lambda v: f"{v:.0f} req/s", offset=max(micro_rps, mono_rps) * 0.01)
    ax1.set_ylabel("Requests / second", fontsize=11, fontweight="bold")
    ax1.set_title("Throughput", fontsize=12, fontweight="bold", pad=10)
    ax1.tick_params(axis='x', labelsize=10)

    # Panel B — Error rate (%)
    micro_err = (metric(micro, "http_req_failed", "value") or 0) * 100
    mono_err  = (metric(mono, "http_req_failed", "value") or 0) * 100

    bars_b = ax2.bar(archs, [micro_err, mono_err], color=colors,
                     edgecolor="white", linewidth=0.5, width=0.5, zorder=3)
    annotate_bars(ax2, bars_b, fmt_func=lambda v: f"{v:.1f}%", offset=max(micro_err, mono_err, 0.1) * 0.02)
    ax2.set_ylabel("Error Rate (%)", fontsize=11, fontweight="bold")
    ax2.set_title("Error Rate", fontsize=12, fontweight="bold", pad=10)
    ax2.tick_params(axis='x', labelsize=10)

    fig.suptitle("Stress Test — Throughput & Error Rate (500 VU)",
                 fontsize=13, fontweight="bold", color=TEXT_COLOR, y=1.02)
    fig.tight_layout()
    save_chart(fig, "02_stress_throughput_errorrate.png")


def chart_03_demo_latency(micro_demo, mono_demo):
    """Chart 3: Demo (write-heavy) latency comparison (150 VU)."""
    labels = ["Avg", "Median", "p90", "p95", "Max"]
    stats  = ["avg", "med", "p(90)", "p(95)", "max"]

    micro_key = "http_req_duration{arch:microservices}"
    mono_key  = "http_req_duration{arch:monolith}"

    micro_vals = [metric(micro_demo, micro_key, s) or 0 for s in stats]
    mono_vals  = [metric(mono_demo, mono_key, s) or 0 for s in stats]

    x = range(len(labels))
    width = 0.35

    fig, ax = plt.subplots(figsize=(10, 6))
    apply_dark_style(fig, ax)

    bars1 = ax.bar([i - width/2 for i in x], micro_vals, width, label="Microservices",
                   color=MICRO_COLOR, edgecolor="white", linewidth=0.5, zorder=3)
    bars2 = ax.bar([i + width/2 for i in x], mono_vals, width, label="Monolith",
                   color=MONO_COLOR, edgecolor="white", linewidth=0.5, zorder=3)

    top = max(max(micro_vals), max(mono_vals))
    annotate_bars(ax, bars1, offset=top * 0.01)
    annotate_bars(ax, bars2, offset=top * 0.01)

    ax.set_xlabel("Latency Percentile", fontsize=11, fontweight="bold")
    ax.set_ylabel("Response Time (ms)", fontsize=11, fontweight="bold")
    ax.set_title("Live Demo Latency — Microservices vs Monolith (150 VU, Write-Heavy)",
                 fontsize=13, fontweight="bold", pad=15)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=10)
    ax.legend(facecolor=PANEL_COLOR, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR, fontsize=10)

    save_chart(fig, "03_demo_latency_comparison.png")


def chart_04_check_breakdown(micro, mono):
    """Chart 4: Check pass/fail breakdown (stress test)."""
    # Collect common check names from both
    micro_checks = micro.get("root_group", {}).get("checks", {})
    mono_checks  = mono.get("root_group", {}).get("checks", {})

    # Use the union of check names, sorted
    all_names = sorted(set(list(micro_checks.keys()) + list(mono_checks.keys())))

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, max(5, len(all_names) * 0.55)))
    apply_dark_style(fig, [ax1, ax2])

    for ax, checks, title, color in [
        (ax1, micro_checks, "Microservices", MICRO_COLOR),
        (ax2, mono_checks, "Monolith", MONO_COLOR),
    ]:
        names = []
        passes = []
        fails = []
        for name in all_names:
            c = checks.get(name, {"passes": 0, "fails": 0})
            # Wrap long names
            wrapped = textwrap.fill(name, 20)
            names.append(wrapped)
            passes.append(c.get("passes", 0))
            fails.append(c.get("fails", 0))

        y = range(len(names))
        bars_pass = ax.barh(list(y), passes, height=0.6, label="Pass",
                           color=color, edgecolor="white", linewidth=0.3, zorder=3, alpha=0.9)
        bars_fail = ax.barh(list(y), fails, height=0.6, left=passes, label="Fail",
                           color="#ff4444", edgecolor="white", linewidth=0.3, zorder=3, alpha=0.85)

        ax.set_yticks(list(y))
        ax.set_yticklabels(names, fontsize=8)
        ax.set_xlabel("Count", fontsize=10, fontweight="bold")
        ax.set_title(title, fontsize=12, fontweight="bold", pad=10)
        ax.legend(facecolor=PANEL_COLOR, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR,
                  fontsize=8, loc="lower right")
        ax.invert_yaxis()

    fig.suptitle("Stress Test — Check Pass / Fail Breakdown",
                 fontsize=13, fontweight="bold", color=TEXT_COLOR, y=1.02)
    fig.tight_layout()
    save_chart(fig, "04_stress_check_breakdown.png")


def chart_05_chaos_vs_normal(micro, chaos):
    """Chart 5: Chaos vs normal latency."""
    labels = ["Avg", "p95", "Max"]
    stats  = ["avg", "p(95)", "max"]

    normal_key = "http_req_duration{arch:microservices}"
    chaos_key  = "http_req_duration{arch:chaos}"

    normal_vals = [metric(micro, normal_key, s) or 0 for s in stats]
    chaos_vals  = [metric(chaos, chaos_key, s) or 0 for s in stats]

    x = range(len(labels))
    width = 0.35

    fig, ax = plt.subplots(figsize=(8, 6))
    apply_dark_style(fig, ax)

    bars1 = ax.bar([i - width/2 for i in x], normal_vals, width, label="Normal (no fault)",
                   color=MICRO_COLOR, edgecolor="white", linewidth=0.5, zorder=3)
    bars2 = ax.bar([i + width/2 for i in x], chaos_vals, width, label="Chaos (5s LLM delay)",
                   color=CHAOS_COLOR, edgecolor="white", linewidth=0.5, zorder=3)

    top = max(max(normal_vals), max(chaos_vals))
    annotate_bars(ax, bars1, offset=top * 0.01)
    annotate_bars(ax, bars2, offset=top * 0.01)

    ax.set_xlabel("Latency Metric", fontsize=11, fontweight="bold")
    ax.set_ylabel("Response Time (ms)", fontsize=11, fontweight="bold")
    ax.set_title("Chaos Engineering — Normal vs Fault-Injected Latency\n(Pumba 5s delay on LLM Service)",
                 fontsize=13, fontweight="bold", pad=15)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=10)
    ax.legend(facecolor=PANEL_COLOR, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR, fontsize=10)

    save_chart(fig, "05_chaos_vs_normal_latency.png")


def chart_06_queue_depth(queue_data):
    """Chart 6: RabbitMQ queue depth over time with phase shading."""
    data_points = queue_data.get("data", [])
    meta = queue_data.get("meta", {})

    times       = [d["time"] for d in data_points]
    total_queue = [d["total"] for d in data_points]
    publish_r   = [d["publishRate"] for d in data_points]
    deliver_r   = [d["deliverRate"] for d in data_points]
    phases      = [d["phase"] for d in data_points]

    fig, ax1 = plt.subplots(figsize=(12, 6))
    apply_dark_style(fig, ax1)

    # Phase background shading
    prev_phase = None
    phase_start = times[0]
    for i, (t, phase) in enumerate(zip(times, phases)):
        if phase != prev_phase and prev_phase is not None:
            color = FLOOD_BG if prev_phase == "FLOOD" else DRAIN_BG
            ax1.axvspan(phase_start, t, alpha=0.3, color=color, zorder=0)
            # Label the phase
            mid = (phase_start + t) / 2
            ax1.text(mid, max(total_queue) * 0.95, prev_phase,
                     ha="center", va="top", fontsize=9, color=TEXT_COLOR,
                     fontweight="bold", alpha=0.6)
            phase_start = t
        prev_phase = phase
    # Final phase
    if prev_phase:
        color = FLOOD_BG if prev_phase == "FLOOD" else DRAIN_BG
        ax1.axvspan(phase_start, times[-1], alpha=0.3, color=color, zorder=0)
        mid = (phase_start + times[-1]) / 2
        ax1.text(mid, max(total_queue) * 0.95, prev_phase,
                 ha="center", va="top", fontsize=9, color=TEXT_COLOR,
                 fontweight="bold", alpha=0.6)

    # Queue depth (left axis)
    line1, = ax1.plot(times, total_queue, color=MICRO_COLOR, linewidth=2.5,
                      label="Queue Depth", zorder=4)
    ax1.fill_between(times, total_queue, alpha=0.15, color=MICRO_COLOR, zorder=2)
    ax1.set_xlabel("Time (seconds)", fontsize=11, fontweight="bold")
    ax1.set_ylabel("Queue Depth (messages)", fontsize=11, fontweight="bold", color=MICRO_COLOR)
    ax1.tick_params(axis="y", labelcolor=MICRO_COLOR)

    # Rates (right axis)
    ax2 = ax1.twinx()
    ax2.set_facecolor("none")
    ax2.tick_params(colors=TEXT_COLOR, labelsize=9)
    ax2.spines["top"].set_visible(False)
    ax2.spines["left"].set_color(GRID_COLOR)
    ax2.spines["bottom"].set_color(GRID_COLOR)
    ax2.spines["right"].set_color(GRID_COLOR)

    line2, = ax2.plot(times, publish_r, color=MONO_COLOR, linewidth=1.5,
                      linestyle="--", label="Publish Rate", zorder=3)
    line3, = ax2.plot(times, deliver_r, color=ACCENT_GREEN, linewidth=1.5,
                      linestyle="-.", label="Deliver Rate", zorder=3)
    ax2.set_ylabel("Rate (msg/s)", fontsize=11, fontweight="bold", color=TEXT_COLOR)

    # Combined legend
    lines = [line1, line2, line3]
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc="upper left",
               facecolor=PANEL_COLOR, edgecolor=GRID_COLOR, labelcolor=TEXT_COLOR, fontsize=9)

    # Meta annotation
    meta_text = (f"Concurrency: {meta.get('concurrency', '?')} | "
                 f"Target RPS: {meta.get('targetRPS', '?')} | "
                 f"Total Sent: {meta.get('totalSent', '?'):,}")
    ax1.text(0.5, -0.12, meta_text, transform=ax1.transAxes,
             ha="center", fontsize=8, color=TEXT_COLOR, alpha=0.7)

    ax1.set_title("RabbitMQ Queue Depth Over Time (Flood → Drain)",
                  fontsize=13, fontweight="bold", pad=15, color=TEXT_COLOR)

    fig.tight_layout()
    save_chart(fig, "06_rabbitmq_queue_depth.png")


def chart_07_summary_table(micro, mono, micro_demo, mono_demo, chaos):
    """Chart 7: Summary table rendered as a figure."""
    # Define rows
    row_defs = [
        ("Avg Latency",    "http_req_duration", "avg",    "ms"),
        ("Median Latency", "http_req_duration", "med",    "ms"),
        ("p90 Latency",    "http_req_duration", "p(90)",  "ms"),
        ("p95 Latency",    "http_req_duration", "p(95)",  "ms"),
        ("Max Latency",    "http_req_duration", "max",    "ms"),
        ("Error Rate",     "http_req_failed",   "value",  "%"),
        ("HTTP Requests",  "http_reqs",         "count",  "int"),
        ("Throughput",     "http_reqs",         "rate",   "rps"),
        ("Iterations",     "iterations",        "count",  "int"),
    ]

    columns = ["Metric", "Micro\n(Stress)", "Mono\n(Stress)",
               "Micro\n(Demo)", "Mono\n(Demo)", "Chaos"]
    data_sources = [micro, mono, micro_demo, mono_demo, chaos]

    def fmt_cell(val, unit):
        if val is None:
            return "n/a"
        if unit == "ms":
            return fmt_ms(val)
        if unit == "%":
            return f"{val * 100:.1f}%"
        if unit == "rps":
            return f"{val:.0f}/s"
        if unit == "int":
            return f"{int(val):,}"
        return str(val)

    table_data = []
    for row_label, metric_key, stat, unit in row_defs:
        row = [row_label]
        for src in data_sources:
            if src is None:
                row.append("n/a")
            else:
                val = metric(src, metric_key, stat)
                row.append(fmt_cell(val, unit))
        table_data.append(row)

    fig, ax = plt.subplots(figsize=(14, 5.5))
    apply_dark_style(fig, ax)
    ax.axis("off")

    table = ax.table(
        cellText=table_data,
        colLabels=columns,
        loc="center",
        cellLoc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.6)

    # Style the table
    for (row, col), cell in table.get_celld().items():
        cell.set_edgecolor(GRID_COLOR)
        cell.set_linewidth(0.5)
        if row == 0:
            # Header row
            cell.set_facecolor("#0d1b3e")
            cell.set_text_props(color=TEXT_COLOR, fontweight="bold", fontsize=9)
        else:
            cell.set_facecolor(PANEL_COLOR)
            cell.set_text_props(color=TEXT_COLOR, fontsize=9)
            # Highlight the metric name column
            if col == 0:
                cell.set_text_props(color=TEXT_COLOR, fontweight="bold", fontsize=9)
            # Colour-code architecture columns
            elif col == 1 or col == 3:  # Microservices columns
                cell.set_text_props(color=MICRO_COLOR, fontsize=9)
            elif col == 2 or col == 4:  # Monolith columns
                cell.set_text_props(color=MONO_COLOR, fontsize=9)
            elif col == 5:  # Chaos column
                cell.set_text_props(color=CHAOS_COLOR, fontsize=9)

    ax.set_title("Performance Results — All Test Scenarios",
                 fontsize=14, fontweight="bold", pad=20, color=TEXT_COLOR)

    save_chart(fig, "07_summary_table.png")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║       FYP Chart Generator — k6 Results → PNG            ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()

    os.makedirs(CHARTS_DIR, exist_ok=True)

    # Load all result files
    print("Loading result files...")
    micro       = load_json("results-microservices.json")
    mono        = load_json("results-monolith.json")
    micro_demo  = load_json("results-demo-microservices.json")
    mono_demo   = load_json("results-demo-monolith.json")
    chaos       = load_json("results-chaos.json")
    queue_data  = load_json("queue-depth-data.json")
    print()

    generated = 0

    # Chart 1: Stress latency
    if micro and mono:
        print("Generating Chart 1: Stress test latency comparison...")
        chart_01_stress_latency(micro, mono)
        generated += 1

    # Chart 2: Throughput & error rate
    if micro and mono:
        print("Generating Chart 2: Throughput & error rate...")
        chart_02_throughput_errorrate(micro, mono)
        generated += 1

    # Chart 3: Demo latency
    if micro_demo and mono_demo:
        print("Generating Chart 3: Demo latency comparison...")
        chart_03_demo_latency(micro_demo, mono_demo)
        generated += 1

    # Chart 4: Check pass/fail breakdown
    if micro and mono:
        print("Generating Chart 4: Check pass/fail breakdown...")
        chart_04_check_breakdown(micro, mono)
        generated += 1

    # Chart 5: Chaos vs normal
    if micro and chaos:
        print("Generating Chart 5: Chaos vs normal latency...")
        chart_05_chaos_vs_normal(micro, chaos)
        generated += 1

    # Chart 6: Queue depth
    if queue_data:
        print("Generating Chart 6: RabbitMQ queue depth...")
        chart_06_queue_depth(queue_data)
        generated += 1

    # Chart 7: Summary table
    print("Generating Chart 7: Summary table...")
    chart_07_summary_table(micro, mono, micro_demo, mono_demo, chaos)
    generated += 1

    print()
    print(f"══════════════════════════════════════════════════════════")
    print(f"  ✅ {generated} charts saved to: {CHARTS_DIR}")
    print(f"══════════════════════════════════════════════════════════")

    return 0 if generated == 7 else 1


if __name__ == "__main__":
    sys.exit(main())
