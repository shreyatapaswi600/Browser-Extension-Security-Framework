# ============================================================
# Reasoning Engine
# ============================================================
#
# Purpose:
#
# Convert structured security evidence into an explainable
# behavioral assessment.
#
# IMPORTANT:
#
# This module does NOT claim that an extension is malware.
# It evaluates the strength and concern of OBSERVED behavior.
#
# The reasoning process considers:
#
#   - sensitivity of the source
#   - whether data reaches a sink
#   - whether data is transformed
#   - whether the destination is external
#   - whether the evidence chain is complete
#
# Later we will add:
#
#   - manifest context
#   - destination reputation
#   - runtime evidence
#   - supply-chain changes
#   - behavioral baselines
#
# ============================================================


# ============================================================
# Sensitivity Weights
# ============================================================

SENSITIVITY_LEVELS = {

    "none": 0,

    "low": 1,

    "medium": 2,

    "high": 3
}


# ============================================================
# Confidence Weights
# ============================================================

CONFIDENCE_LEVELS = {

    "NONE": 0,

    "LOW": 1,

    "MEDIUM": 2,

    "HIGH": 3
}


# ============================================================
# Utility Functions
# ============================================================

def highest_confidence(values):
    """
    Return the strongest confidence level in a list.
    """

    if not values:

        return "NONE"


    return max(
        values,
        key=lambda value:
            CONFIDENCE_LEVELS.get(
                value,
                0
            )
    )


def normalize_destination_category(category):
    """
    Normalize destination category.
    """

    if not category:

        return "unknown"


    return category.lower()


# ============================================================
# Analyze Individual Evidence
# ============================================================

def analyze_evidence_item(evidence):
    """
    Reason about one evidence item.

    This function evaluates the combination of observations
    rather than treating individual APIs as malicious.
    """

    source_sensitivity = evidence.get(
        "source_sensitivity",
        "none"
    )


    destination_category = normalize_destination_category(
        evidence.get(
            "destination_category"
        )
    )


    transformations = evidence.get(
        "transformations",
        []
    )


    sink = evidence.get(
        "sink"
    )


    destination = evidence.get(
        "destination"
    )


    static_confidence = evidence.get(
        "static_confidence",
        "NONE"
    )


    # ========================================================
    # Evidence Indicators
    # ========================================================

    indicators = []


    # --------------------------------------------------------
    # Sensitive source
    # --------------------------------------------------------

    if source_sensitivity == "high":

        indicators.append(
            "high_sensitivity_source"
        )

    elif source_sensitivity == "medium":

        indicators.append(
            "medium_sensitivity_source"
        )

    elif source_sensitivity == "low":

        indicators.append(
            "low_sensitivity_source"
        )


    # --------------------------------------------------------
    # Data transformation
    # --------------------------------------------------------

    if transformations:

        indicators.append(
            "data_transformation"
        )


    # --------------------------------------------------------
    # Network sink
    # --------------------------------------------------------

    if sink:

        indicators.append(
            "network_sink"
        )


    # --------------------------------------------------------
    # External destination
    # --------------------------------------------------------

    if destination_category == "external":

        indicators.append(
            "external_destination"
        )

    elif destination_category == "local":

        indicators.append(
            "local_destination"
        )

    else:

        indicators.append(
            "unknown_destination"
        )


    # ========================================================
    # Determine Behavioral Concern
    # ========================================================
    #
    # We are deliberately using combinations of evidence.
    #
    # A network request alone is not enough.
    # A cookie source alone is not enough.
    #
    # The concern increases when those observations are
    # connected.
    # ========================================================

    concern = "LOW"


    reasoning = []


    # --------------------------------------------------------
    # High sensitivity + network + external destination
    # --------------------------------------------------------

    if (
        source_sensitivity == "high"
        and sink
        and destination_category == "external"
    ):

        concern = "HIGH"


        reasoning.append(
            "A highly sensitive data source appears "
            "to reach a network operation."
        )


        reasoning.append(
            "The network operation targets an external "
            "destination."
        )


        # ----------------------------------------------------
        # Transformation provides additional context.
        # ----------------------------------------------------

        if transformations:

            reasoning.append(
                "The source-derived data is transformed "
                "before or during transmission."
            )


    # --------------------------------------------------------
    # Medium sensitivity + external network
    # --------------------------------------------------------

    elif (
        source_sensitivity == "medium"
        and sink
        and destination_category == "external"
    ):

        concern = "MEDIUM"


        reasoning.append(
            "A moderately sensitive data source appears "
            "to reach an external network operation."
        )


        if transformations:

            reasoning.append(
                "A transformation is applied to the "
                "source-derived data."
            )


    # --------------------------------------------------------
    # Sensitive source + network, destination unknown
    # --------------------------------------------------------

    elif (
        source_sensitivity in {
            "high",
            "medium"
        }
        and sink
    ):

        concern = "MEDIUM"


        reasoning.append(
            "Sensitive data appears to reach a network "
            "operation."
        )


        reasoning.append(
            "The final network destination could not "
            "be fully classified."
        )


    # --------------------------------------------------------
    # Sensitive source without network transmission
    # --------------------------------------------------------

    elif source_sensitivity in {
        "high",
        "medium"
    }:

        concern = "MEDIUM"


        reasoning.append(
            "Sensitive browser-related data was accessed."
        )


        reasoning.append(
            "No connected external network transmission "
            "was established by this evidence."
        )


    # --------------------------------------------------------
    # Network operation without sensitive source
    # --------------------------------------------------------

    elif sink:

        concern = "LOW"


        reasoning.append(
            "A network operation was observed, but this "
            "evidence does not establish transmission of "
            "sensitive source data."
        )


    # --------------------------------------------------------
    # Nothing significant
    # --------------------------------------------------------

    else:

        concern = "LOW"


        reasoning.append(
            "No strong security-relevant behavioral "
            "relationship was established."
        )


    # ========================================================
    # Confidence Interpretation
    # ========================================================

    # --------------------------------------------------------
    # Strong static evidence
    # --------------------------------------------------------

    if static_confidence == "HIGH":

        reasoning.append(
            "The static analyzer established a strong "
            "evidence chain."
        )


    elif static_confidence == "MEDIUM":

        reasoning.append(
            "The static analyzer established a partial "
            "evidence chain."
        )


    elif static_confidence == "LOW":

        reasoning.append(
            "The available static evidence is limited."
        )


    # ========================================================
    # Build Assessment
    # ========================================================

    assessment = {

        "concern_level":
            concern,

        "static_confidence":
            static_confidence,

        "indicators":
            indicators,

        "reasoning":
            reasoning,

        "source_sensitivity":
            source_sensitivity,

        "destination_category":
            destination_category,

        "destination":
            destination,

        "sink":
            sink
    }


    return assessment


# ============================================================
# Overall Assessment
# ============================================================

def calculate_overall_assessment(
    assessments
):
    """
    Combine multiple evidence assessments.

    This is NOT a simple sum of individual API scores.

    Instead, the strongest behavioral relationship and the
    overall confidence are considered.
    """

    if not assessments:

        return {

            "overall_concern": "LOW",

            "overall_confidence": "NONE",

            "finding_count": 0,

            "reasoning": [
                "No correlated security evidence was established."
            ]
        }


    concern_values = {

        "LOW": 1,

        "MEDIUM": 2,

        "HIGH": 3,

        "CRITICAL": 4
    }


    # --------------------------------------------------------
    # Strongest concern
    # --------------------------------------------------------

    strongest = max(
        assessments,
        key=lambda assessment:
            concern_values.get(
                assessment["concern_level"],
                0
            )
    )


    overall_concern = strongest[
        "concern_level"
    ]


    # --------------------------------------------------------
    # Overall confidence
    # --------------------------------------------------------

    overall_confidence = highest_confidence(
        [
            assessment[
                "static_confidence"
            ]

            for assessment in assessments
        ]
    )


    # --------------------------------------------------------
    # Construct overall reasoning
    # --------------------------------------------------------

    reasoning = []


    if overall_concern == "HIGH":

        reasoning.append(
            "At least one strong behavioral relationship "
            "involves sensitive data and an external network "
            "operation."
        )


    elif overall_concern == "MEDIUM":

        reasoning.append(
            "Security-relevant behavior was established, "
            "but additional context is required before "
            "drawing a stronger conclusion."
        )


    else:

        reasoning.append(
            "No strong suspicious behavioral relationship "
            "was established by the available evidence."
        )


    reasoning.append(
        f"{len(assessments)} correlated evidence finding(s) "
        "were evaluated."
    )


    return {

        "overall_concern":
            overall_concern,

        "overall_confidence":
            overall_confidence,

        "finding_count":
            len(assessments),

        "reasoning":
            reasoning
    }


# ============================================================
# Main Reasoning Function
# ============================================================

def reason_about_evidence(
    evidence_result
):
    """
    Run the reasoning engine over evidence generated by the
    evidence engine.
    """

    evidence_items = evidence_result.get(
        "evidence",
        []
    )


    assessments = []


    # ========================================================
    # Analyze each finding
    # ========================================================

    for evidence in evidence_items:

        assessment = analyze_evidence_item(
            evidence
        )


        # Keep original evidence together with its assessment.

        assessments.append({

            "evidence":
                evidence,

            "assessment":
                assessment
        })


    # ========================================================
    # Overall assessment
    # ========================================================

    overall = calculate_overall_assessment(
        [
            item["assessment"]
            for item in assessments
        ]
    )


    # ========================================================
    # Return
    # ========================================================

    return {

        "findings":
            assessments,

        "overall":
            overall
    }