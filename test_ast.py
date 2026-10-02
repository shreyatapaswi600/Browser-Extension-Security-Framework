from analyzer.ast_analyzer import analyze_javascript_file


file_path = "Sample_Extension_v3/background.js"

model = analyze_javascript_file(file_path)


print("=" * 60)
print("JAVASCRIPT PROGRAM MODEL")
print("=" * 60)


print("\nFile")
print("-" * 60)
print(model.file)


print("\nSyntax Error")
print("-" * 60)
print(model.syntax_error)


print("\nFunction Definitions")
print("-" * 60)

for function in model.function_definitions:
    print(
        f"Line {function.line}, "
        f"Column {function.column}: "
        f"{function.name}"
    )

    print(
        f"    Parameters: {function.parameters}"
    )


print("\nFunction Parameters")
print("-" * 60)

for parameter in model.function_parameters:
    print(
        f"Line {parameter.line}, "
        f"Column {parameter.column}: "
        f"{parameter.function} -> {parameter.name}"
    )


print("\nFunction Calls")
print("-" * 60)

for call in model.function_calls:
    print(
        f"Line {call.line}, "
        f"Column {call.column}: "
        f"{call.name}"
    )

    print(
        f"    Arguments: {call.arguments}"
    )


print("\nVariable Assignments")
print("-" * 60)

for assignment in model.variable_assignments:
    print(
        f"Line {assignment.line}, "
        f"Column {assignment.column}: "
        f"{assignment.variable} = {assignment.value}"
    )


print("\nMember / API Access")
print("-" * 60)

for member in model.member_access:
    print(
        f"Line {member.line}, "
        f"Column {member.column}: "
        f"{member.expression}"
    )


print("\nURLs")
print("-" * 60)

for url in model.urls:
    print(f"- {url}")


print("\n" + "=" * 60)
print("PROGRAM MODEL COMPLETE")
print("=" * 60)