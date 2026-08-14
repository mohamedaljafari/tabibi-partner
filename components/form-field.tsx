import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  secure?: boolean;
};

export function FormField({ label, error, secure = false, style, ...inputProps }: FormFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const showPasswordToggle = secure;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : undefined]}>
        <TextInput
          {...inputProps}
          style={[styles.input, style]}
          placeholderTextColor="#A19787"
          secureTextEntry={secure && !isVisible}
          textAlign="right"
          textAlignVertical="center"
        />
        {showPasswordToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isVisible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            onPress={() => setIsVisible((visible) => !visible)}
            style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}
          >
            {isVisible ? <MaterialIcons name="visibility-off" size={21} color="#8A8173" /> : <MaterialIcons name="visibility" size={21} color="#8A8173" />}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  label: { color: "#465132", fontSize: 14, fontWeight: "700", lineHeight: 20, textAlign: "right" },
  inputWrap: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderColor: "#E4DCCB",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 56,
  },
  inputError: { borderColor: "#D45454" },
  input: { color: "#465132", flex: 1, fontSize: 16, height: 56, paddingHorizontal: 16 },
  passwordToggle: { alignItems: "center", height: 48, justifyContent: "center", width: 48 },
  pressed: { opacity: 0.62 },
  error: { color: "#A23E35", fontSize: 12, lineHeight: 18, textAlign: "right" },
});
