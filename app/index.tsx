import { Link, LinkText } from "@/components/ui/link";
import { useRouter } from "expo-router";
import "@/global.css";
import { Text, View } from "react-native";

export default function IndexScreen() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Login Page</Text>
      <Link onPress={() => router.push("/register")}>
        <LinkText>Don't have Account? Register</LinkText>
      </Link>
    </View>
  );
}
