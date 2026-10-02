from analyzer.data_flow_analyzer import analyze_data_flow
from analyzer.evidence_engine import analyze_evidence
from analyzer.reasoning_engine import reason_about_evidence


# ============================================================
# Extension To Analyze
# ============================================================

filepath = "Sample_Extension_v2/background.js"


# ============================================================
# Step 1
# Data-flow analysis
# ============================================================

data_flow_result = analyze_data_flow(
    filepath
)


# ============================================================
# Step 2
# Evidence analysis
# ============================================================

evidence_result = analyze_evidence(
    data_flow_result
)


# ============================================================
# Step 3
# Reasoning
# ============================================================

reasoning_result = reason_about_evidence(
    evidence_result
)


# ============================================================
# Header
# ============================================================

print("=" * 75)
print("BEHAVIORAL REASONING ENGINE")
print("=" * 75)


# ============================================================
# Individual Findings
# ============================================================

print("\nEvidence Assessments")
print("-" * 75)


if reasoning_result["findings"]:

    for index, item in enumerate(
        reasoning_result["findings"],
        start=1
    ):

        evidence = item[
            "evidence"
        ]

        assessment = item[
            "assessment"
        ]


        print(
            f"\nFinding #{index}"
        )


        # ----------------------------------------------------
        # Behavior
        # ----------------------------------------------------

        print(
            "Behavior:",
            evidence.get(
                "behavior"
            )
        )


        # ----------------------------------------------------
        # Source
        # ----------------------------------------------------

        print(
            "Source:",
            evidence.get(
                "source"
            )
        )


        print(
            "Source Sensitivity:",
            assessment.get(
                "source_sensitivity"
            )
        )


        # ----------------------------------------------------
        # Sink
        # ----------------------------------------------------

        print(
            "Network Sink:",
            assessment.get(
                "sink"
            )
        )


        # ----------------------------------------------------
        # Destination
        # ----------------------------------------------------

        print(
            "Destination:",
            assessment.get(
                "destination"
            )
        )


        print(
            "Destination Category:",
            assessment.get(
                "destination_category"
            )
        )


        # ----------------------------------------------------
        # Evidence Chain
        # ----------------------------------------------------

        print(
            "Evidence Chain:"
        )

        print(
            "    "
            + "  ->  ".join(
                evidence.get(
                    "evidence_chain",
                    []
                )
            )
        )


        # ----------------------------------------------------
        # Indicators
        # ----------------------------------------------------

        print(
            "Indicators:"
        )

        for indicator in assessment.get(
            "indicators",
            []
        ):

            print(
                f"    - {indicator}"
            )


        # ----------------------------------------------------
        # Concern
        # ----------------------------------------------------

        print(
            "Concern Level:",
            assessment.get(
                "concern_level"
            )
        )


        # ----------------------------------------------------
        # Confidence
        # ----------------------------------------------------

        print(
            "Static Confidence:",
            assessment.get(
                "static_confidence"
            )
        )


        # ----------------------------------------------------
        # Reasoning
        # ----------------------------------------------------

        print(
            "Reasoning:"
        )

        for reason in assessment.get(
            "reasoning",
            []
        ):

            print(
                f"    - {reason}"
            )


else:

    print(
        "No evidence findings available."
    )


# ============================================================
# Overall Assessment
# ============================================================

overall = reasoning_result[
    "overall"
]


print("\n\nOverall Assessment")
print("-" * 75)


print(
    "Overall Concern:",
    overall[
        "overall_concern"
    ]
)


print(
    "Overall Confidence:",
    overall[
        "overall_confidence"
    ]
)


print(
    "Finding Count:",
    overall[
        "finding_count"
    ]
)


print(
    "Overall Reasoning:"
)


for reason in overall[
    "reasoning"
]:

    print(
        f"    - {reason}"
    )


# ============================================================
# Complete
# ============================================================

print("\n" + "=" * 75)
print("REASONING ANALYSIS COMPLETE")
print("=" * 75)