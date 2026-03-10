import { View, Text, StyleSheet } from 'react-native';
import { Link, LinkText } from "@/components/ui/link";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Page</Text>
      
      <View style={styles.menu}>
        <Text style={styles.menuTitle}>Menu</Text>
        <Link onPress={() => router.push("/register")}>
          <LinkText>Go to Register Page</LinkText>
        </Link>
        <Link onPress={() => router.push("/navigation")}>
          <LinkText>Go to Navigation Page</LinkText>
        </Link>
        <Link onPress={() => router.push("/")}>
          <LinkText>Logout (Go to Login)</LinkText>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', 
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  menu: {
    width: '100%',
    alignItems: 'center',
    gap: 15,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#666',
  }
});
