from analyzer.context_analyzer import analyze_context


# ============================================================
# Configuration
# ============================================================

extension_folder = "Sample_Extension_v2"


# ============================================================
# Run Analysis
# ============================================================

result = analyze_context(
    extension_folder
)


print("=" * 75)
print("MANIFEST ↔ CODE BEHAVIOR CONTEXT ANALYSIS")
print("=" * 75)


# ============================================================
# Error
# ============================================================

if "error" in result:

    print("\nERROR")
    print("-" * 75)
    print(result["error"])


else:

    # ========================================================
    # Extension
    # ========================================================

    print("\nExtension")
    print("-" * 75)

    manifest = result["manifest"]

    print(
        "Name:",
        manifest["name"]
    )

    print(
        "Version:",
        manifest["version"]
    )

    print(
        "Manifest Version:",
        manifest["manifest_version"]
    )


    # ========================================================
    # Manifest
    # ========================================================

    print("\nDeclared Permissions")
    print("-" * 75)

    permissions = result[
        "declared_permissions"
    ]

    if permissions:

        for permission in permissions:

            print(
                " -",
                permission
            )

    else:

        print("None")


    print("\nDeclared Host Permissions")
    print("-" * 75)

    hosts = result[
        "declared_host_permissions"
    ]

    if hosts:

        for host in hosts:

            print(
                " -",
                host
            )

    else:

        print("None")


    # ========================================================
    # Permission Analysis
    # ========================================================

    print("\nPermission ↔ Code Analysis")
    print("-" * 75)

    for item in result[
        "permission_analysis"
    ]:

        print(
            "\nPermission:",
            item["permission"]
        )

        print(
            "Status:",
            item["status"]
        )

        print(
            "Description:",
            item["description"]
        )

        print("Observed Patterns:")

        if item["observed_patterns"]:

            for pattern in item[
                "observed_patterns"
            ]:

                print(
                    "    -",
                    pattern
                )

        else:

            print("    None")


    # ========================================================
    # Host Analysis
    # ========================================================

    print("\nHost Permission Analysis")
    print("-" * 75)

    for item in result[
        "host_analysis"
    ]:

        print(
            "\nHost Permission:",
            item["host_permission"]
        )

        print(
            "Status:",
            item["status"]
        )

        print("Observed URLs:")

        if item["observed_urls"]:

            for url in item[
                "observed_urls"
            ]:

                print(
                    "    -",
                    url
                )

        else:

            print("    None")


    # ========================================================
    # Permission Context
    # ========================================================

    print("\nPermission Context Summary")
    print("-" * 75)

    permission_context = result[
        "permission_context"
    ]

    print(
        "Aligned:",
        permission_context["aligned"]
    )

    print(
        "Declared but Not Observed:",
        permission_context[
            "declared_not_observed"
        ]
    )

    print(
        "Unmapped:",
        permission_context["unmapped"]
    )


    # ========================================================
    # Host Scope
    # ========================================================

    print("\nHost Scope Interpretation")
    print("-" * 75)

    host_scope = result[
        "host_scope"
    ]

    print(
        "Status:",
        host_scope["status"]
    )

    print(
        "Reason:",
        host_scope["reason"]
    )

    if "matching_destinations" in host_scope:

        print(
            "Matching Destinations:",
            host_scope[
                "matching_destinations"
            ]
        )


    # ========================================================
    # Observed Behavior
    # ========================================================

    print("\nObserved JavaScript Behavior")
    print("-" * 75)

    behavior = result[
        "observed_behavior"
    ]


    print("Observed APIs:")

    if behavior["apis"]:

        for api in behavior["apis"]:

            print(
                "    -",
                api
            )

    else:

        print("    None")


    print("\nSecurity-Relevant Sources:")

    if behavior["sources"]:

        for source in behavior[
            "sources"
        ]:

            print(
                "    -",
                source
            )

    else:

        print("    None")


    print("\nTransformations:")

    if behavior["transformations"]:

        for transformation in behavior[
            "transformations"
        ]:

            print(
                "    -",
                transformation
            )

    else:

        print("    None")


    print("\nNetwork Operations:")

    if behavior["network_operations"]:

        for operation in behavior[
            "network_operations"
        ]:

            print(
                "    -",
                operation
            )

    else:

        print("    None")


    print("\nNetwork Destinations:")

    if behavior["network_destinations"]:

        for destination in behavior[
            "network_destinations"
        ]:

            print(
                "    -",
                destination
            )

    else:

        print("    None")


    # ========================================================
    # Evidence
    # ========================================================

    print("\nSecurity Evidence")
    print("-" * 75)

    evidence_summary = result[
        "evidence"
    ]["summary"]

    print(
        "Evidence Count:",
        evidence_summary[
            "evidence_count"
        ]
    )

    print(
        "Sensitive Data Flow:",
        evidence_summary[
            "sensitive_data_flow_detected"
        ]
    )

    print(
        "Sources Observed:",
        evidence_summary[
            "sources_observed"
        ]
    )

    print(
        "Network Sinks:",
        evidence_summary[
            "network_sinks_observed"
        ]
    )

    print(
        "Highest Source Sensitivity:",
        evidence_summary[
            "highest_source_sensitivity"
        ]
    )

    print(
        "Static Evidence Confidence:",
        evidence_summary[
            "static_confidence"
        ]
    )


    # ========================================================
    # Reasoning
    # ========================================================

    print("\nBehavioral Reasoning")
    print("-" * 75)

    overall = result[
        "reasoning"
    ]["overall"]

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

    print("\nReasoning:")

    for reason in overall[
        "reasoning"
    ]:

        print(
            "    -",
            reason
        )


    # ========================================================
    # Behavioral Summary
    # ========================================================

    print("\nStructured Behavioral Summary")
    print("-" * 75)

    for observation in result[
        "behavior_summary"
    ]:

        print(
            " -",
            observation
        )


print("\n" + "=" * 75)
print("BEHAVIOR CONTEXT ANALYSIS COMPLETE")
print("=" * 75)