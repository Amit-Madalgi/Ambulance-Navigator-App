import { Link, LinkText } from "@/components/ui/link";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function RegisterScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register Page</Text>
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
