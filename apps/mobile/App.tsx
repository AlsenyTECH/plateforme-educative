import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { USER_ROLES } from "@plateforme/shared";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plateforme Éducative — mobile</Text>
      <Text>Placeholder de structure. Rôles : {USER_ROLES.join(", ")}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
});
