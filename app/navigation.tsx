import { View, Text, StyleSheet } from "react-native";
import { Link, LinkText } from "@/components/ui/link";
import { useRouter } from "expo-router";

export default function NavigationScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Navigation Page</Text>
      <Link onPress={() => router.push("/")}>
        <LinkText>Back to Login</LinkText>
      </Link>
      <Link onPress={() => router.push("/(tabs)")}>
        <LinkText>Go to Home</LinkText>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
